import { Router } from "express";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

const userQuerySchema = z.object({
  email: z.string().email().optional(),
  q: z.string().min(2).optional(),
  take: z.coerce.number().min(1).max(100).optional(),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { email, q, take } = userQuerySchema.parse(req.query);

    const users = await prisma.user.findMany({
      where: {
        OR: q
          ? [
              { displayName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ]
          : undefined,
        email: email ?? undefined,
      },
      include: {
        projects: {
          select: {
            id: true,
            title: true,
            slug: true,
            highlight: true,
            status: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      take: take ?? 25,
      orderBy: { createdAt: "desc" },
    });

    res.json({ users });
  })
);

const createUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(2),
  bio: z.string().max(2000).optional(),
  role: z.nativeEnum(UserRole).optional(),
  avatarUrl: z.string().url().optional(),
  websiteUrl: z.string().url().optional(),
  location: z.string().optional(),
});

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = createUserSchema.parse(req.body);

    const user = await prisma.user.create({
      data: payload,
    });

    res.status(201).json({ user });
  })
);

const updateUserSchema = createUserSchema.partial();

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        projects: {
          orderBy: { createdAt: "desc" },
        },
        contributions: {
          include: {
            project: {
              select: {
                id: true,
                title: true,
                slug: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ user });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const updates = updateUserSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updates,
    });

    res.json({ user });
  })
);

export const usersRouter = router;

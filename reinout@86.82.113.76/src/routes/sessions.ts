import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

const listSchema = z.object({
  userId: z.string().optional(),
  active: z.coerce.boolean().optional(),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { userId, active } = listSchema.parse(req.query);

    const sessions = await prisma.session.findMany({
      where: {
        userId: userId ?? undefined,
        expiresAt: active === undefined ? undefined : { gt: new Date() },
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: [{ expiresAt: "desc" }],
    });

    res.json({ sessions });
  })
);

const createSessionSchema = z.object({
  userId: z.string(),
  token: z.string().min(16),
  expiresAt: z.coerce.date(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
});

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = createSessionSchema.parse(req.body);

    const session = await prisma.session.create({
      data: payload,
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    res.status(201).json({ session });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.session.delete({
      where: { id: req.params.id },
    });

    res.status(204).end();
  })
);

export const sessionsRouter = router;

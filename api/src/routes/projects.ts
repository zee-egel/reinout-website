import { Router } from "express";
import { z } from "zod";
import { ContributionRole, ProjectStatus } from "@prisma/client";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

const projectQuerySchema = z.object({
  status: z.nativeEnum(ProjectStatus).optional(),
  highlight: z.coerce.boolean().optional(),
  ownerId: z.string().optional(),
  take: z.coerce.number().min(1).max(100).optional(),
  search: z.string().min(2).optional(),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filters = projectQuerySchema.parse(req.query);
    const projects = await prisma.project.findMany({
      where: {
        status: filters.status ?? undefined,
        highlight: filters.highlight ?? undefined,
        ownerId: filters.ownerId ?? undefined,
        OR: filters.search
          ? [
              { title: { contains: filters.search, mode: "insensitive" } },
              { summary: { contains: filters.search, mode: "insensitive" } },
              { keywords: { has: filters.search.toLowerCase() } },
            ]
          : undefined,
      },
      include: {
        owner: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        collaborators: {
          orderBy: { order: "asc" },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: [
        { highlight: "desc" },
        { featuredSince: "desc" },
        { createdAt: "desc" },
      ],
      take: filters.take ?? 50,
    });

    res.json({ projects });
  })
);

const collaboratorSchema = z.object({
  userId: z.string(),
  role: z.nativeEnum(ContributionRole).default(ContributionRole.CONTRIBUTOR),
  description: z.string().optional(),
  order: z.number().int().min(0).optional(),
});

const projectBaseSchema = z.object({
  ownerId: z.string(),
  slug: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]+[a-z0-9]$/, "Slug can contain lowercase letters, numbers and hyphens only"),
  title: z.string().min(3).max(120),
  summary: z.string().max(280).optional(),
  description: z.string().optional(),
  repoUrl: z.string().url().optional(),
  liveUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
  highlight: z.boolean().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  techStack: z.array(z.string().min(1)).default([]),
  keywords: z.array(z.string().min(1)).default([]),
  problemSolved: z.string().optional(),
  impact: z.string().optional(),
  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  featuredSince: z.coerce.date().optional(),
  collaborators: z.array(collaboratorSchema).optional(),
});

const createProjectSchema = projectBaseSchema;

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = createProjectSchema.parse(req.body);

    const project = await prisma.project.create({
      data: {
        ownerId: payload.ownerId,
        slug: payload.slug,
        title: payload.title,
        summary: payload.summary,
        description: payload.description,
        repoUrl: payload.repoUrl,
        liveUrl: payload.liveUrl,
        coverImageUrl: payload.coverImageUrl,
        highlight: payload.highlight ?? false,
        status: payload.status ?? ProjectStatus.DRAFT,
        techStack: payload.techStack,
        keywords: payload.keywords.map((keyword) => keyword.toLowerCase()),
        problemSolved: payload.problemSolved,
        impact: payload.impact,
        startedAt: payload.startedAt,
        completedAt: payload.completedAt,
        featuredSince: payload.featuredSince,
        collaborators: payload.collaborators
          ? {
              create: payload.collaborators.map((collaborator) => ({
                userId: collaborator.userId,
                role: collaborator.role,
                description: collaborator.description,
                order: collaborator.order ?? 0,
              })),
            }
          : undefined,
      },
      include: {
        owner: {
          select: {
            id: true,
            displayName: true,
          },
        },
        collaborators: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json({ project });
  })
);

const updateProjectSchema = projectBaseSchema.partial();

router.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const project = await prisma.project.findUnique({
      where: { slug: req.params.slug },
      include: {
        owner: {
          select: {
            id: true,
            displayName: true,
            bio: true,
            avatarUrl: true,
          },
        },
        collaborators: {
          orderBy: { order: "asc" },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    res.json({ project });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const payload = updateProjectSchema.parse(req.body);

    if (payload.collaborators) {
      res.status(400).json({
        error: "Use /projects/:id/collaborators to update collaborator assignments",
      });
      return;
    }

    const { keywords, ownerId, ...projectData } = payload;

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        ...projectData,
        ...(ownerId ? { ownerId } : {}),
        keywords: keywords?.map((keyword) => keyword.toLowerCase()),
      },
      include: {
        owner: {
          select: {
            id: true,
            displayName: true,
          },
        },
        collaborators: {
          orderBy: { order: "asc" },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    res.json({ project });
  })
);

const collaboratorsUpsertSchema = z.object({
  collaborators: z.array(
    collaboratorSchema.extend({
      id: z.string().optional(),
    })
  ),
});

router.put(
  "/:id/collaborators",
  asyncHandler(async (req, res) => {
    const { collaborators } = collaboratorsUpsertSchema.parse(req.body);

    const projectId = req.params.id;

    const result = await prisma.$transaction(async (trx) => {
      const existing = await trx.projectContribution.findMany({
        where: { projectId },
      });

      const incomingIds = collaborators.map((item) => item.id).filter(Boolean) as string[];
      const idsToRemove = existing
        .filter((item) => !incomingIds.includes(item.id))
        .map((item) => item.id);

      if (idsToRemove.length) {
        await trx.projectContribution.deleteMany({
          where: { id: { in: idsToRemove } },
        });
      }

      for (const collaborator of collaborators) {
        if (collaborator.id) {
          await trx.projectContribution.update({
            where: { id: collaborator.id },
            data: {
              role: collaborator.role,
              description: collaborator.description,
              order: collaborator.order ?? 0,
            },
          });
        } else {
          await trx.projectContribution.create({
            data: {
              projectId,
              userId: collaborator.userId,
              role: collaborator.role,
              description: collaborator.description,
              order: collaborator.order ?? 0,
            },
          });
        }
      }

      return trx.project.findUniqueOrThrow({
        where: { id: projectId },
        include: {
          collaborators: {
            orderBy: { order: "asc" },
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
            },
          },
        },
      });
    });

    res.json({ project: result });
  })
);

export const projectsRouter = router;

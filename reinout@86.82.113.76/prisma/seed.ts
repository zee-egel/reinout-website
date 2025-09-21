import { PrismaClient, ContributionRole, ProjectStatus, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const owner = await prisma.user.upsert({
    where: { email: "portfolio@reinout.dev" },
    update: {
      displayName: "Reinout Mos",
      role: UserRole.OWNER,
    },
    create: {
      email: "portfolio@reinout.dev",
      displayName: "Reinout Mos",
      role: UserRole.OWNER,
      bio: "Software engineer and creative coder building interactive ML demos.",
      websiteUrl: "https://reinout.dance",
      location: "The Netherlands",
    },
  });

  await prisma.project.upsert({
    where: { slug: "portfolio-playground" },
    update: {
      highlight: true,
      status: ProjectStatus.PUBLISHED,
    },
    create: {
      ownerId: owner.id,
      slug: "portfolio-playground",
      title: "Interactive Portfolio Playground",
      summary: "A responsive portfolio that blends ML-powered demos with traditional case studies.",
      description:
        "Full-stack playground showcasing reinforcement learning experiments, interactive visuals, and long-form write-ups for delivered client work.",
      repoUrl: "https://github.com/reinout-dev/reinout-website",
      liveUrl: "https://reinout.dance",
      highlight: true,
      status: ProjectStatus.PUBLISHED,
      techStack: ["react", "typescript", "tailwind", "prisma", "postgres"],
      keywords: ["portfolio", "machine learning", "creative coding"],
      impact: "Help visitors explore both playful experiments and production projects without leaving the site.",
      problemSolved: "Merge personal experiments with professional case studies in a cohesive experience.",
      featuredSince: new Date(),
      collaborators: {
        create: [
          {
            userId: owner.id,
            role: ContributionRole.LEAD,
            description: "Product design, engineering, and storytelling",
            order: 0,
          },
        ],
      },
    },
  });

  console.log("Seed data ready ✔");
}

main()
  .catch((error) => {
    console.error("Failed to seed database", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

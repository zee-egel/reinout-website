import type { Route } from "./+types/home";
import { Homepage } from "~/components/welcome";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Dino Runner" },
    { name: "description", content: "Play the classic offline Dino game." },
  ];
}

export default function Home() {
  return <Homepage />;
}

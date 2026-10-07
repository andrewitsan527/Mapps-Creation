import { MillProgramDesk } from "@/components/mill-program-desk";
import {
  listMillPrograms,
  listMillProgramSources,
} from "@/server/actions/mill-program-entries";

export default async function MillProgramPage() {
  const [programs, sources] = await Promise.all([
    listMillPrograms(),
    listMillProgramSources(),
  ]);
  return <MillProgramDesk programs={programs} sources={sources} />;
}

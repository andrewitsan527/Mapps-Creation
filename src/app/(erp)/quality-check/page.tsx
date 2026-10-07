import { QualityCheckDesk } from "@/components/quality-check-desk";
import {
  listQualityCheckPrograms,
  listQualityChecks,
  listQualityCheckWorks,
} from "@/server/actions/quality-checks";

export default async function QualityCheckPage() {
  const [works, programs, records] = await Promise.all([
    listQualityCheckWorks(),
    listQualityCheckPrograms(),
    listQualityChecks(),
  ]);
  return (
    <QualityCheckDesk works={works} programs={programs} records={records} />
  );
}

import { QualityCheckDesk } from "@/components/quality-check-desk";
import {
  listQualityCheckPrograms,
  listQualityChecks,
  listQualityCheckWorks,
  listWithoutQcGroups,
} from "@/server/actions/quality-checks";

export default async function QualityCheckPage() {
  const [works, programs, records, withoutQc] = await Promise.all([
    listQualityCheckWorks(),
    listQualityCheckPrograms(),
    listQualityChecks(),
    listWithoutQcGroups(),
  ]);
  return (
    <QualityCheckDesk
      works={works}
      programs={programs}
      records={records}
      withoutQc={withoutQc}
    />
  );
}

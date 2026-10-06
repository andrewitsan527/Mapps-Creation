import { JobMasterDesk } from "@/components/job-master-desk";
import { listJobs } from "@/server/actions/jobs";

export default async function JobsPage() {
  const jobs = await listJobs();
  return <JobMasterDesk jobs={jobs} />;
}

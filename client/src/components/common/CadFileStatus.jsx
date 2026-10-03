// File availability and pending change control are independent of part approval.
export default function CadFileStatus({ file }) {
  return <>
    {file?.missing && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-800 dark:bg-red-900/30 dark:text-red-300">Missing file</span>}
    {file?.pending_eco && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Pending ECO</span>}
  </>;
}

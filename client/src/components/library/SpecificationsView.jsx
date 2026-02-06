const SpecificationsView = ({ componentDetails }) => {
  const specs = componentDetails?.specifications || [];

  return (
    <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Specifications</h3>
      {specs.length > 0 ? (
        <div className="space-y-2">
          {specs.map((spec, index) => (
            <div key={index} className="flex justify-between items-center border-b border-gray-100 dark:border-[#3a3a3a] pb-2 last:border-0">
              <span className="text-sm text-gray-600 dark:text-gray-400">{spec.spec_name}:</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {spec.spec_value}{spec.unit ? ` ${spec.unit}` : ''}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">No specifications available</p>
      )}
    </div>
  );
};

export default SpecificationsView;

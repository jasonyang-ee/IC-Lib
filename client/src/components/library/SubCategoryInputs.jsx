import { ChevronDown } from 'lucide-react';

/**
 * SubCategoryInputs - 4-level cascading subcategory dropdown inputs.
 *
 * Props:
 * - editData: object            current form data
 * - onFieldChange: (field, value) => void
 * - subCat1Ref, subCat2Ref, subCat3Ref, subCat4Ref: React refs
 * - subCat1Open / setSubCat1Open, subCat2Open / setSubCat2Open,
 *   subCat3Open / setSubCat3Open, subCat4Open / setSubCat4Open: boolean / setter
 * - subCat1Suggestions, subCat2Suggestions, subCat3Suggestions, subCat4Suggestions: string[]
 * - onSubCat1Change, onSubCat2Change, onSubCat3Change: (value) => void
 * - setSubCat2Suggestions, setSubCat3Suggestions: setter (for clearing)
 */
const SubCategoryInputs = ({
  editData,
  onFieldChange,
  subCat1Ref,
  subCat2Ref,
  subCat3Ref,
  subCat4Ref,
  subCat1Open, setSubCat1Open,
  subCat2Open, setSubCat2Open,
  subCat3Open, setSubCat3Open,
  subCat4Open, setSubCat4Open,
  subCat1Suggestions,
  subCat2Suggestions,
  subCat3Suggestions,
  subCat4Suggestions,
  onSubCat1Change,
  onSubCat2Change,
  onSubCat3Change,
  setSubCat2Suggestions,
  setSubCat3Suggestions,
}) => (
  <>
    {/* Sub-Category 1 */}
    <div ref={subCat1Ref} className="relative">
      <label className="block text-gray-600 dark:text-gray-400 mb-1">
        Sub-Category 1
      </label>
      <div className="relative">
        <input
          type="text"
          value={editData.sub_category1 || ''}
          onChange={(e) => {
            const newValue = e.target.value;
            onFieldChange('sub_category1', newValue);
            setSubCat1Open(true);
            // Clear sub-categories 2 and 3 when typing
            if (newValue !== editData.sub_category1) {
              onFieldChange('sub_category2', '');
              onFieldChange('sub_category3', '');
              setSubCat2Suggestions([]);
              setSubCat3Suggestions([]);
            }
          }}
          onFocus={() => editData.category_id && setSubCat1Open(true)}
          disabled={!editData.category_id}
          placeholder={editData.category_id ? "Type or select..." : "Select category first"}
          className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm disabled:bg-gray-100 dark:disabled:bg-[#252525] disabled:cursor-not-allowed"
        />
        {editData.category_id && (
          <button
            type="button"
            onClick={() => setSubCat1Open(!subCat1Open)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${subCat1Open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      {subCat1Open && editData.category_id && subCat1Suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#333333] border border-gray-300 dark:border-[#444444] rounded-md shadow-lg max-h-60 overflow-auto">
          {subCat1Suggestions
            .filter(s => !editData.sub_category1 || s.toLowerCase().includes(editData.sub_category1.toLowerCase()))
            .map((suggestion, idx) => (
              <div
                key={idx}
                onClick={() => {
                  onSubCat1Change(suggestion);
                  setSubCat1Open(false);
                }}
                className="px-3 py-2 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-900 dark:text-gray-100 text-sm border-b border-gray-100 dark:border-[#3a3a3a] last:border-b-0"
              >
                {suggestion}
              </div>
            ))}
        </div>
      )}
    </div>

    {/* Sub-Category 2 */}
    <div ref={subCat2Ref} className="relative">
      <label className="block text-gray-600 dark:text-gray-400 mb-1">
        Sub-Category 2
      </label>
      <div className="relative">
        <input
          type="text"
          value={editData.sub_category2 || ''}
          onChange={(e) => {
            const newValue = e.target.value;
            onFieldChange('sub_category2', newValue);
            setSubCat2Open(true);
            // Clear sub-category 3 when typing
            if (newValue !== editData.sub_category2) {
              onFieldChange('sub_category3', '');
              setSubCat3Suggestions([]);
            }
          }}
          onFocus={() => editData.sub_category1 && setSubCat2Open(true)}
          disabled={!editData.sub_category1}
          placeholder={editData.sub_category1 ? "Type or select..." : "Select sub-category 1 first"}
          className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm disabled:bg-gray-100 dark:disabled:bg-[#252525] disabled:cursor-not-allowed"
        />
        {editData.sub_category1 && (
          <button
            type="button"
            onClick={() => setSubCat2Open(!subCat2Open)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${subCat2Open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      {subCat2Open && editData.sub_category1 && subCat2Suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#333333] border border-gray-300 dark:border-[#444444] rounded-md shadow-lg max-h-60 overflow-auto">
          {subCat2Suggestions
            .filter(s => !editData.sub_category2 || s.toLowerCase().includes(editData.sub_category2.toLowerCase()))
            .map((suggestion, idx) => (
              <div
                key={idx}
                onClick={() => {
                  onSubCat2Change(suggestion);
                  setSubCat2Open(false);
                }}
                className="px-3 py-2 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-900 dark:text-gray-100 text-sm border-b border-gray-100 dark:border-[#3a3a3a] last:border-b-0"
              >
                {suggestion}
              </div>
            ))}
        </div>
      )}
    </div>

    {/* Sub-Category 3 */}
    <div ref={subCat3Ref} className="relative">
      <label className="block text-gray-600 dark:text-gray-400 mb-1">
        Sub-Category 3
      </label>
      <div className="relative">
        <input
          type="text"
          value={editData.sub_category3 || ''}
          onChange={(e) => {
            onSubCat3Change(e.target.value);
            setSubCat3Open(true);
          }}
          onFocus={() => editData.sub_category2 && setSubCat3Open(true)}
          disabled={!editData.sub_category2}
          placeholder={editData.sub_category2 ? "Type or select..." : "Select sub-category 2 first"}
          className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm disabled:bg-gray-100 dark:disabled:bg-[#252525] disabled:cursor-not-allowed"
        />
        {editData.sub_category2 && (
          <button
            type="button"
            onClick={() => setSubCat3Open(!subCat3Open)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${subCat3Open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      {subCat3Open && editData.sub_category2 && subCat3Suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#333333] border border-gray-300 dark:border-[#444444] rounded-md shadow-lg max-h-60 overflow-auto">
          {subCat3Suggestions
            .filter(s => !editData.sub_category3 || s.toLowerCase().includes(editData.sub_category3.toLowerCase()))
            .map((suggestion, idx) => (
              <div
                key={idx}
                onClick={() => {
                  onSubCat3Change(suggestion);
                  setSubCat3Open(false);
                }}
                className="px-3 py-2 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-900 dark:text-gray-100 text-sm border-b border-gray-100 dark:border-[#3a3a3a] last:border-b-0"
              >
                {suggestion}
              </div>
            ))}
        </div>
      )}
    </div>

    {/* Sub-Category 4 */}
    <div ref={subCat4Ref} className="relative">
      <label className="block text-gray-600 dark:text-gray-400 mb-1">
        Sub-Category 4
      </label>
      <div className="relative">
        <input
          type="text"
          value={editData.sub_category4 || ''}
          onChange={(e) => {
            onFieldChange('sub_category4', e.target.value);
            setSubCat4Open(true);
          }}
          onFocus={() => editData.sub_category3 && setSubCat4Open(true)}
          disabled={!editData.sub_category3}
          placeholder={editData.sub_category3 ? "Type or select..." : "Select sub-category 3 first"}
          className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm disabled:bg-gray-100 dark:disabled:bg-[#252525] disabled:cursor-not-allowed"
        />
        {editData.sub_category3 && (
          <button
            type="button"
            onClick={() => setSubCat4Open(!subCat4Open)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${subCat4Open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      {subCat4Open && editData.sub_category3 && subCat4Suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#333333] border border-gray-300 dark:border-[#444444] rounded-md shadow-lg max-h-60 overflow-auto">
          {subCat4Suggestions
            .filter(s => !editData.sub_category4 || s.toLowerCase().includes(editData.sub_category4.toLowerCase()))
            .map((suggestion, idx) => (
              <div
                key={idx}
                onClick={() => {
                  onFieldChange('sub_category4', suggestion);
                  setSubCat4Open(false);
                }}
                className="px-3 py-2 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-900 dark:text-gray-100 text-sm border-b border-gray-100 dark:border-[#3a3a3a] last:border-b-0"
              >
                {suggestion}
              </div>
            ))}
        </div>
      )}
    </div>
  </>
);

export default SubCategoryInputs;

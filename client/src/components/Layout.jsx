import Sidebar from './Sidebar';

const Layout = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-[#1f1f1f]">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="w-full mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;

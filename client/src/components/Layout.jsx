import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout = () => {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-[#1f1f1f]">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="w-full h-full mx-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;

import { ArrowDownUp, LucideHome, Settings, Users, Box } from 'lucide-react';
import ConnectWallet from '@/components/ConnectWalletButton';
import { Link } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
export default function TabNav() {
  const location = useLocation();
  const path = location.pathname;

  const tabs = [
    { name: 'Home', icon: <LucideHome />, route: '/' },
    { name: 'Transactions', icon: <ArrowDownUp />, route: '/transactions/' },
    { name: 'Configuration', icon: <Users />, route: '/config/' },
    { name: 'Program', icon: <Box />, route: '/program/' },
    { name: 'Settings', icon: <Settings />, route: '/settings/' },
  ];

  return (
    <>
      <aside
        id="sidebar"
        className="z-40 hidden h-auto md:fixed md:left-0 md:top-0 md:block md:h-screen md:w-3/12 lg:w-3/12"
        aria-label="Sidebar"
      >
        <div className="flex h-auto flex-col justify-between overflow-y-auto border-slate-200 bg-slate-200 px-3 py-4 md:h-full md:border-r">
          <div>
            <Link to="/">
              <div className="mb-10 flex items-center rounded-lg px-3 py-2 text-slate-900 dark:text-white">
                <img src="/logo.png" width="150" height="auto" />
              </div>
            </Link>
            <ul className="space-y-2 text-sm font-medium">
              {tabs.map((tab) => (
                <li key={tab.route}>
                  <Link
                    to={tab.route}
                    className={`flex items-center rounded-lg px-4 py-3 text-slate-900 ${
                      (path!.startsWith(`${tab.route}/`) && tab.route !== '/') || tab.route === path
                        ? 'bg-slate-400'
                        : 'hover:bg-slate-400'
                    }`}
                  >
                    {tab.icon}
                    <span className="ml-3 flex-1 whitespace-nowrap text-base text-black">
                      {tab.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <ConnectWallet />
        </div>
      </aside>

      <aside
        id="mobile-navbar"
        className="bg-slate-20 fixed inset-x-0 bottom-0 z-50 block bg-slate-300 p-2 md:hidden"
        aria-label="Mobile navbar"
      >
        <div className="mx-auto mt-1 grid h-full max-w-lg grid-cols-4 font-medium">
          {tabs.map((tab) => (
            <Link to={tab.route} key={tab.route}>
              <button
                type="button"
                className="group inline-flex flex-col items-center justify-center rounded-md px-5 py-2 hover:bg-slate-400"
              >
                {tab.icon}
                <span className="flex-1 whitespace-nowrap text-sm text-slate-900">{tab.name}</span>
              </button>
            </Link>
          ))}
        </div>
      </aside>
    </>
  );
}

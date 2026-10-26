import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import LoginPage        from './components/auth/LoginPage';
import SuperAdminPage   from './components/dashboard/SuperAdminPage';
import AppLayout        from './components/shared/AppLayout';
import Dashboard        from './components/dashboard/Dashboard';
import CustomersPage    from './components/customers/CustomersPage';
import TransactionsPage from './components/transactions/TransactionsPage';
import AdjustmentPage   from './components/transactions/AdjustmentPage';
import ReportsPage      from './components/reports/ReportsPage';
import AgentsPage       from './components/agents/AgentsPage';
import MasterPage       from './components/master/MasterPage';
import GroupsPage       from './components/master/GroupsPage';
import AccountTypesPage from './components/master/AccountTypesPage';
import SettingsPage     from './components/settings/SettingsPage';
import MISReportsPage   from './components/reports/MISReportsPage';



export default function App() {
  const [page,      setPage]      = useState('dashboard');
  const [transProps,setTransProps]= useState({});
  const { user, loading } = useAuth();

  

  

  if (!user)                    return <LoginPage/>;
  if (user.role==='superadmin') return <SuperAdminPage/>;

  const navigate = (p, props={}) => {
    setPage(p);
    setTransProps(p==='transactions' && props.preSelectAccId ? props : {});
  };

  const render = () => {
    switch (page) {
      case 'dashboard':     return <Dashboard onNavigate={navigate}/>;
      case 'customers':     return <CustomersPage onNavigate={navigate}/>;
      case 'transactions':  return <TransactionsPage {...transProps}/>;
      case 'adjustment':    return <AdjustmentPage/>;
      case 'reports':       return <ReportsPage/>;
      case 'agents':        return <AgentsPage/>;
      case 'master':        return <MasterPage/>;
      case 'groups':        return <GroupsPage/>;
      case 'account-types': return <AccountTypesPage/>;
      case 'settings':      return <SettingsPage/>;
      case 'mis-reports':   return <MISReportsPage/>;
      default:              return <Dashboard onNavigate={navigate}/>;
    }
  };

  return (
    <AppLayout activePage={page} onNavigate={navigate}>
      {render()}
    </AppLayout>
  );
}
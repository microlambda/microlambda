import { mockDashboardPowerBI, mockGroupJoin, mockSource } from '@dataportal/test-helpers';
import { IAllowedGroup, ICurrentUser, IDashboard, IGroupJoin, ISource } from '@dataportal/types';
import { filterDashboards } from '../../src';

describe('filter-dashboards', () => {
  let listDashboard: IDashboard[];
  let source: ISource;
  let groupJoin: IGroupJoin[];
  let currentUser: ICurrentUser;
  let isSourceOwner: boolean;

  it('return all dashboards if admin', () => {
    const allowed_group1: IAllowedGroup = { group_id: '3', group_name: '...' };
    const allowed_group2: IAllowedGroup = { group_id: '4', group_name: '..' };
    listDashboard = [
      mockDashboardPowerBI({ allowed_groups: [allowed_group1], name: 'name1' }),
      mockDashboardPowerBI({ allowed_groups: [allowed_group2], name: 'name2' }),
    ];
    source = mockSource({ pk: '1', powerbi: listDashboard });
    groupJoin = [mockGroupJoin({ pk: '1' }), mockGroupJoin({ pk: '0' })];
    currentUser = { user_id: '123', role: 'admin', name: 'abc' };
    isSourceOwner = false;
    const res = filterDashboards(source, groupJoin, currentUser, isSourceOwner);
    expect(res.length).toBe(2);
  });
  it('return all dashboards if isSourceOwner is true', () => {
    const allowed_group1: IAllowedGroup = { group_id: '3', group_name: '...' };
    const allowed_group2: IAllowedGroup = { group_id: '4', group_name: '..' };
    listDashboard = [
      mockDashboardPowerBI({ allowed_groups: [allowed_group1], name: 'name1' }),
      mockDashboardPowerBI({ allowed_groups: [allowed_group2], name: 'name2' }),
    ];
    source = mockSource({ pk: '1', powerbi: listDashboard });
    groupJoin = [mockGroupJoin({ pk: '1' }), mockGroupJoin({ pk: '0' })];
    currentUser = { user_id: '123', role: 'user', name: 'abc' };
    isSourceOwner = true;
    const res = filterDashboards(source, groupJoin, currentUser, isSourceOwner);
    expect(res.length).toBe(2);
  });
  it('dont return disable dashboard', () => {
    listDashboard = [
      mockDashboardPowerBI({ allowed_groups: [], is_disable: true, name: 'name1' }),
      mockDashboardPowerBI({ allowed_groups: [], name: 'name2' }),
    ];
    source = mockSource({ pk: '1', powerbi: listDashboard });
    groupJoin = [mockGroupJoin({ pk: '1' }), mockGroupJoin({ pk: '0' })];
    currentUser = { user_id: '123', role: 'user', name: 'abc' };
    isSourceOwner = false;
    const res = filterDashboards(source, groupJoin, currentUser, isSourceOwner);
    expect(res.length).toBe(1);
  });
  it('return dashboard without allowed_group', () => {
    listDashboard = [mockDashboardPowerBI({}), mockDashboardPowerBI({})];
    source = mockSource({ pk: '1', powerbi: listDashboard });
    groupJoin = [mockGroupJoin({}), mockGroupJoin({})];
    currentUser = { user_id: '123', role: 'user', name: 'abc' };
    isSourceOwner = false;
    const res = filterDashboards(source, groupJoin, currentUser, isSourceOwner);
    expect(res.length).toBe(2);
  });
  it('return dashboard with allowed_group empty list ', () => {
    listDashboard = [mockDashboardPowerBI({ allowed_groups: [] }), mockDashboardPowerBI({ allowed_groups: [] })];
    source = mockSource({ pk: '1', powerbi: listDashboard });
    groupJoin = [mockGroupJoin({}), mockGroupJoin({})];
    currentUser = { user_id: '123', role: 'user', name: 'abc' };
    isSourceOwner = false;
    const res = filterDashboards(source, groupJoin, currentUser, isSourceOwner);
    expect(res.length).toBe(2);
  });
  it('return dashboard only with allowed_group corresponding to groupJoin', () => {
    const allowed_group1: IAllowedGroup = { group_id: '1', group_name: '...' };
    const allowed_group2: IAllowedGroup = { group_id: '4', group_name: '..' };
    listDashboard = [
      mockDashboardPowerBI({ allowed_groups: [allowed_group1], name: 'name1' }),
      mockDashboardPowerBI({ allowed_groups: [allowed_group2], name: 'name2' }),
    ];
    source = mockSource({ pk: '1', powerbi: listDashboard });
    groupJoin = [mockGroupJoin({ pk: '1' }), mockGroupJoin({ pk: '0' })];
    const groupJoin2 = [mockGroupJoin({ pk: '20' }), mockGroupJoin({ pk: '21' })];
    currentUser = { user_id: '123', role: 'user', name: 'abc' };
    isSourceOwner = false;
    const res = filterDashboards(source, groupJoin, currentUser, isSourceOwner);
    const res2 = filterDashboards(source, groupJoin2, currentUser, isSourceOwner);
    expect(res.length).toBe(1);
    expect(res2.length).toBe(0);
  });
});

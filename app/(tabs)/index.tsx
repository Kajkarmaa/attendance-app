import { useAuth } from '@/contexts/AuthContext';
import { fetchEmployees, fetchPendingUsers, type EmployeeUser, type PendingUser } from '@/services/users';
import { Feather, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from 'react-native';

export default function HomeScreen() {
  const { logout, user, isLoading } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [department, setDepartment] = useState('All');
  const [showDepartment, setShowDepartment] = useState(false);
  const [activeTab, setActiveTab] = useState<'employees' | 'pending'>('employees');
  const [searchTerm, setSearchTerm] = useState('');
  const [employees, setEmployees] = useState<EmployeeUser[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'GOOD MORNING,';
    if (hour < 18) return 'GOOD AFTERNOON,';
    return 'GOOD EVENING,';
  }, []);
  const displayName = useMemo(() => {
    if (isLoading) return '...';
    return user?.name || user?.email || 'Admin';
  }, [user, isLoading]);

  const stats = useMemo(
    () => [
      { label: 'Staff Heads', value: '45', color: '#60A5FA' },
      { label: 'Staff Present', value: '15', color: '#D4A537' },
      { label: 'Staff Absence', value: '08', color: '#F472B6' },
      { label: 'Staff Late', value: '06', color: '#FBBF24' },
      { label: 'Staff Leave', value: '05', color: '#A78BFA' },
      { label: 'Staff Early', value: '16', color: '#FB923C' },
    ],
    []
  );

  useEffect(() => {
    loadLists();
  }, []);

  const loadLists = async () => {
    setListLoading(true);
    try {
      const [emps, pend] = await Promise.all([fetchEmployees(), fetchPendingUsers()]);
      setEmployees(emps || []);
      setPendingUsers(pend || []);
    } catch (error: any) {
      console.log('list fetch failed', error?.message);
    } finally {
      setListLoading(false);
    }
  };

  const filteredEmployees = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return employees.filter((emp) => {
      const name = emp.userId?.name?.toLowerCase() || '';
      const email = emp.userId?.email?.toLowerCase() || '';
      const id = emp.employeeId?.toLowerCase() || '';
      const dept = emp.department || '';
      const matchesTerm = !term || name.includes(term) || email.includes(term) || id.includes(term);
      const matchesDept = department === 'All' || dept === department;
      return matchesTerm && matchesDept;
    });
  }, [employees, searchTerm, department]);

  const filteredPending = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return pendingUsers.filter((p) => {
      const name = p.name?.toLowerCase() || '';
      const email = p.email?.toLowerCase() || '';
      return !term || name.includes(term) || email.includes(term);
    });
  }, [pendingUsers, searchTerm]);



  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerLabel}>{greeting}</Text>
            <Text style={styles.headerName}>{displayName}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.headerBell}>
              <Feather name="bell" size={18} color="#FFFFFF" />
            </Pressable>
            <Pressable style={styles.headerBell} onPress={handleLogout}>
              <Feather name="log-out" size={18} color="#F87171" />
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.statsWrapper}>
        <View style={styles.statsCard}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsTitle}>Attendance Tracking</Text>
            <View style={styles.statsHeaderRight}>
              <Text style={styles.statsMonth}>APR</Text>
              <Feather name="calendar" size={14} color="#9CA3AF" />
            </View>
          </View>

          <View style={styles.statsGrid}>
            {stats.map((item) => (
              <View
                key={item.label}
                style={{ width: isWide ? '31%' : '48%' }}
                >
                <View style={styles.statItemRow}>
                  <View style={[styles.statBar, { backgroundColor: item.color }]} />
                  <View style={styles.statTextBlock}>
                    <Text style={styles.statValue}>{item.value}</Text>
                    <Text style={styles.statLabel}>{item.label}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.listContent}>
        <View style={styles.searchBar}>
          <Feather name="search" size={16} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search staff members..."
            placeholderTextColor="#9CA3AF"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>

        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tabButton, activeTab === 'employees' && styles.tabButtonActive]}
            onPress={() => setActiveTab('employees')}>
            <Text
              style={activeTab === 'employees' ? styles.tabTextActive : styles.tabText}
            >
              Employees
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, activeTab === 'pending' && styles.tabButtonActive]}
            onPress={() => setActiveTab('pending')}>
            <Text
              style={activeTab === 'pending' ? styles.tabTextActive : styles.tabText}
            >
              Pending
            </Text>
          </Pressable>
        </View>

        {activeTab === 'employees' && (
          <View style={styles.filterRow}>
            <Pressable
              style={styles.filterSecondary}
              onPress={() => setShowDepartment(true)}>
              <Text style={styles.filterSecondaryText}>{department}</Text>
              <Ionicons name="chevron-down" size={14} color="#6B7280" />
            </Pressable>
          </View>
        )}

        <View style={styles.staffList}>
          {listLoading && (
            <Text style={styles.loadingText}>Loading...</Text>
          )}

          {!listLoading && activeTab === 'employees' && filteredEmployees.map((emp) => {
            const name = emp.userId?.name || emp.employeeId;
            const role = emp.designation || emp.userId?.designation || 'Employee';
            const division = emp.department || 'Department';
            const empId = emp.employeeId;
            return (
              <Pressable
                key={emp._id || emp.employeeId}
                style={styles.staffCard}
                onPress={() =>
                  router.push({
                    pathname: '/employee-profile',
                    params: {
                      name,
                      role,
                      employeeId: empId,
                      division,
                    },
                  })
                }>
                <View style={styles.placeholderAvatar} />
                <View style={styles.staffInfo}>
                  <Text style={styles.staffName}>{name}</Text>
                  <Text style={styles.staffRole}>{role}</Text>
                  <Text style={styles.staffMeta}>{division} • {empId}</Text>
                </View>
                <View style={styles.staffStatus}>
                  <Text style={styles.staffStatusText}>APPROVED</Text>
                  <Text style={styles.staffTime}>{emp.joinDate?.slice(0, 10) || ''}</Text>
                </View>
              </Pressable>
            );
          })}

          {!listLoading && activeTab === 'pending' && filteredPending.map((p) => (
            <Pressable
              key={p._id}
              style={styles.staffCard}
              onPress={() =>
                router.push({
                  pathname: '/employee-profile',
                  params: {
                    name: p.name,
                    role: 'Pending',
                    employeeId: p._id,
                    division: p.email,
                    phone: p.phone,
                    status: p.status,
                  },
                })
              }>
              <View style={styles.placeholderAvatar} />
              <View style={styles.staffInfo}>
                <Text style={styles.staffName}>{p.name}</Text>
                <Text style={styles.staffRole}>{p.email}</Text>
                <Text style={styles.staffMeta}>Phone: {p.phone}</Text>
              </View>
              <View style={styles.staffStatus}>
                <Text style={styles.pendingStatusText}>PENDING</Text>
                <Text style={styles.staffTime}>{p.createdAt?.slice(0, 10) || ''}</Text>
              </View>
            </Pressable>
          ))}

          {!listLoading && activeTab === 'employees' && filteredEmployees.length === 0 && (
            <Text style={styles.emptyText}>No employees found.</Text>
          )}
          {!listLoading && activeTab === 'pending' && filteredPending.length === 0 && (
            <Text style={styles.emptyText}>No pending users found.</Text>
          )}
        </View>
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => router.push('/add-employee')}>
        <Feather name="plus" size={22} color="#FFFFFF" />
      </Pressable>

      <Modal
        transparent
        visible={showDepartment}
        animationType="fade"
        onRequestClose={() => setShowDepartment(false)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowDepartment(false)}>
          <View style={styles.dropdownCard}>
            {['All', 'Sales', 'HR', 'Engineering', 'Marketing'].map((item) => (
              <Pressable
                key={item}
                style={styles.dropdownItem}
                onPress={() => {
                  setDepartment(item);
                  setShowDepartment(false);
                }}>
                <Text style={styles.dropdownText}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  flex: {
    flex: 1,
  },
  header: {
    backgroundColor: '#2F2F2F',
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    letterSpacing: 2,
  },
  headerName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '600',
    marginTop: 4,
  },
  headerBell: {
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  statsWrapper: {
    marginTop: -24,
    paddingHorizontal: 24,
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statsTitle: {
    color: '#2F2F2F',
    fontWeight: '600',
  },
  statsHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsMonth: {
    color: '#9CA3AF',
    fontSize: 12,
    marginRight: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  statItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statBar: {
    height: 24,
    width: 6,
    borderRadius: 8,
  },
  statTextBlock: {
    marginLeft: 12,
  },
  statValue: {
    color: '#2F2F2F',
    fontSize: 18,
    fontWeight: '600',
  },
  statLabel: {
    color: '#6B7280',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 112,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  searchInput: {
    marginLeft: 8,
    flex: 1,
    fontSize: 13,
    color: '#374151',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  tabButtonActive: {
    backgroundColor: '#D4A537',
    borderColor: '#D4A537',
  },
  tabText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 12,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  filterPrimary: {
    backgroundColor: '#D4A537',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterPrimaryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  filterSecondary: {
    marginLeft: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterSecondaryText: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '600',
  },
  staffList: {
    marginTop: 16,
  },
  loadingText: {
    color: '#6B7280',
    textAlign: 'center',
    marginVertical: 12,
  },
  emptyText: {
    color: '#9CA3AF',
    textAlign: 'center',
    marginVertical: 12,
  },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  staffAvatar: {
    height: 48,
    width: 48,
    borderRadius: 24,
  },
  placeholderAvatar: {
    height: 48,
    width: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  staffInfo: {
    flex: 1,
    marginLeft: 12,
  },
  staffName: {
    color: '#2F2F2F',
    fontWeight: '600',
  },
  staffRole: {
    color: '#6B7280',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  staffMeta: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 2,
  },
  staffStatus: {
    alignItems: 'flex-end',
  },
  staffStatusText: {
    color: '#D4A537',
    fontSize: 11,
    fontWeight: '600',
  },
  pendingStatusText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
  },
  staffTime: {
    color: '#D4A537',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    height: 56,
    width: 56,
    borderRadius: 28,
    backgroundColor: '#D4A537',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 24,
    paddingTop: 180,
  },
  dropdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dropdownText: {
    color: '#2F2F2F',
    fontSize: 13,
    fontWeight: '600',
  },
});

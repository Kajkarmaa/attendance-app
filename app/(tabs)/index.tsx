import MonthYearPicker from '@/components/ui/month-year-picker';
import { useAuth } from '@/contexts/AuthContext';
import { fetchDailySummary, type DailyAttendanceSummary } from '@/services/attendance';
import { generatePayroll } from '@/services/payroll';
import {
  convertPendingUserToEmployee,
  fetchEmployees,
  fetchPendingUsers,
  type EmployeeUser,
  type PendingUser
} from '@/services/users';
import { Feather, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [selectedPayrollEmployee, setSelectedPayrollEmployee] = useState<EmployeeUser | null>(null);
  const [payrollMonth, setPayrollMonth] = useState(() => new Date().getMonth() + 1);
  const [payrollYear, setPayrollYear] = useState(() => new Date().getFullYear());
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollMessage, setPayrollMessage] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedPendingUser, setSelectedPendingUser] = useState<PendingUser | null>(null);
  const [convertDesignation, setConvertDesignation] = useState('Software Developer');
  const [convertDepartment, setConvertDepartment] = useState('Engineering');
  const [convertSalary, setConvertSalary] = useState('50000');
  const [convertLoading, setConvertLoading] = useState(false);
  const [convertMessage, setConvertMessage] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);
  const [dailySummary, setDailySummary] = useState<DailyAttendanceSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
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

  const stats = useMemo(() => {
    const formatValue = (value?: number, formatter?: (num: number) => string) => {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return '--';
      }
      return formatter ? formatter(value) : `${value}`;
    };

    return [
      { label: 'Staff Heads', value: formatValue(dailySummary?.totalEmployees), color: '#60A5FA' },
      { label: 'Checked In', value: formatValue(dailySummary?.totalCheckedIn), color: '#34D399' },
      { label: 'Checked Out', value: formatValue(dailySummary?.totalCheckedOut), color: '#0EA5E9' },
      { label: 'Staff Present', value: formatValue(dailySummary?.staffPresent), color: '#D4A537' },
      { label: 'Staff Absent', value: formatValue(dailySummary?.staffAbsent), color: '#F472B6' },
      { label: 'Staff Leave', value: formatValue(dailySummary?.staffOnLeave), color: '#A78BFA' },
      {
        label: 'Attendance Rate',
        value: formatValue(dailySummary?.attendanceRate, (num) => `${num.toFixed(0)}%`),
        color: '#F97316',
      },
      {
        label: 'Avg Work Hours',
        value: formatValue(dailySummary?.averageWorkHours, (num) => `${num.toFixed(1)}h`),
        color: '#10B981',
      },
    ];
  }, [dailySummary]);

  const summaryMonthLabel = useMemo(() => {
    if (!dailySummary?.date) {
      return 'TODAY';
    }
    const date = new Date(dailySummary.date);
    if (Number.isNaN(date.getTime())) {
      return dailySummary.date;
    }
    return date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
  }, [dailySummary]);

  useEffect(() => {
    loadLists();
    loadDailySummary();
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

  const loadDailySummary = async () => {
    setSummaryLoading(true);
    try {
      const summary = await fetchDailySummary();
      setDailySummary(summary);
    } catch (error: any) {
      console.log('daily summary fetch failed', error?.message);
    } finally {
      setSummaryLoading(false);
    }
  };

  const openPayrollModal = (employee: EmployeeUser) => {
    setSelectedPayrollEmployee(employee);
    const now = new Date();
    setPayrollMonth(now.getMonth() + 1);
    setPayrollYear(now.getFullYear());
    setPayrollMessage(null);
    setShowPayrollModal(true);
  };

  const closePayrollModal = () => {
    if (payrollLoading) return;
    setShowPayrollModal(false);
    setSelectedPayrollEmployee(null);
    setPayrollMessage(null);
  };

  const handleGeneratePayroll = async () => {
    if (!selectedPayrollEmployee?.employeeId) {
      setPayrollMessage({ text: 'Missing employee identifier.', tone: 'error' });
      return;
    }

    setPayrollLoading(true);
    setPayrollMessage(null);
    try {
      const response = await generatePayroll({
        month: payrollMonth,
        year: payrollYear,
        employeeId: selectedPayrollEmployee.employeeId,
      });
      setPayrollMessage({ text: response?.message || 'Payroll generated successfully.', tone: 'success' });
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Failed to generate payroll.';
      setPayrollMessage({ text: message, tone: 'error' });
    } finally {
      setPayrollLoading(false);
    }
  };

  const openConvertModal = (pending: PendingUser) => {
    setSelectedPendingUser(pending);
    setConvertDesignation(pending.role || 'Software Developer');
    setConvertDepartment('Engineering');
    setConvertSalary('50000');
    setConvertMessage(null);
    setShowConvertModal(true);
  };

  const closeConvertModal = () => {
    if (convertLoading) return;
    setShowConvertModal(false);
    setSelectedPendingUser(null);
    setConvertMessage(null);
  };

  const handleConvertToEmployee = async () => {
    if (!selectedPendingUser?._id) {
      setConvertMessage({ text: 'Pending user not found.', tone: 'error' });
      return;
    }

    const designation = convertDesignation.trim();
    const departmentValue = convertDepartment.trim();
    const salaryNumber = Number(convertSalary);

    if (!designation || !departmentValue) {
      setConvertMessage({ text: 'Please fill designation and department.', tone: 'error' });
      return;
    }

    if (!Number.isFinite(salaryNumber) || salaryNumber <= 0) {
      setConvertMessage({ text: 'Enter a valid salary amount.', tone: 'error' });
      return;
    }

    setConvertLoading(true);
    setConvertMessage(null);
    try {
      const response = await convertPendingUserToEmployee(selectedPendingUser._id, {
        designation,
        department: departmentValue,
        salary: salaryNumber,
      });
      setConvertMessage({ text: response?.message || 'User converted successfully.', tone: 'success' });
      await loadLists();
      setTimeout(() => {
        closeConvertModal();
      }, 800);
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Failed to convert user.';
      setConvertMessage({ text: message, tone: 'error' });
    } finally {
      setConvertLoading(false);
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
              {summaryLoading ? (
                <ActivityIndicator size="small" color="#9CA3AF" />
              ) : (
                <>
                  <Text style={styles.statsMonth}>{summaryMonthLabel}</Text>
                  <Feather name="calendar" size={14} color="#9CA3AF" />
                </>
              )}
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
            const name = emp?.name || emp.employeeId;
            const role = emp?.designation || 'Employee';
            const division = emp?.department || 'Department';
            const empId = emp?.employeeId;
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
                  <Pressable
                    style={styles.staffActionButton}
                    onPress={(event) => {
                      event.stopPropagation();
                      openPayrollModal(emp);
                    }}
                  >
                    <Text style={styles.staffActionText}>Generate Payroll</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })}

          {!listLoading && activeTab === 'pending' && filteredPending.map((p) => (
            <View
              key={p._id}
              style={styles.staffCard}
            >
              <View style={styles.placeholderAvatar} />
              <View style={styles.staffInfo}>
                <Text style={styles.staffName}>{p.name}</Text>
                <Text style={styles.staffRole}>{p.email}</Text>
                <Text style={styles.staffMeta}>Phone: {p.phone}</Text>
              </View>
              <View style={styles.staffStatus}>
                <Text style={styles.pendingStatusText}>PENDING</Text>
                <Text style={styles.staffTime}>{p.createdAt?.slice(0, 10) || ''}</Text>
                <Pressable
                  style={styles.pendingActionButton}
                  onPress={(event) => {
                    event.stopPropagation();
                    openConvertModal(p);
                  }}
                >
                  <Text style={styles.pendingActionText}>Convert to Employee</Text>
                </Pressable>
              </View>
            </View>
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
        visible={showPayrollModal}
        animationType="fade"
        onRequestClose={closePayrollModal}>
        <Pressable
          style={styles.centeredOverlay}
          onPress={closePayrollModal}>
          <Pressable style={styles.payrollCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.payrollTitle}>Generate Payroll</Text>
            <Text style={styles.payrollSubtitle}>
              {selectedPayrollEmployee?.userId?.name || selectedPayrollEmployee?.employeeId || 'Select employee'}
            </Text>
            {selectedPayrollEmployee?.employeeId && (
              <Text style={styles.payrollMeta}>
                ID: {selectedPayrollEmployee.employeeId} • {selectedPayrollEmployee.department || 'Department'}
              </Text>
            )}

            <View style={styles.payrollPickerWrapper}>
              <MonthYearPicker
                month={payrollMonth}
                year={payrollYear}
                onMonthChange={setPayrollMonth}
                onYearChange={setPayrollYear}
              />
            </View>

            {payrollMessage && (
              <Text
                style={
                  payrollMessage.tone === 'success'
                    ? styles.payrollMessageSuccess
                    : styles.payrollMessageError
                }>
                {payrollMessage.text}
              </Text>
            )}

            <View style={styles.payrollActions}>
              <Pressable
                style={styles.payrollCancelButton}
                disabled={payrollLoading}
                onPress={closePayrollModal}>
                <Text style={styles.payrollCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.payrollSubmitButton, payrollLoading && styles.payrollSubmitButtonDisabled]}
                onPress={handleGeneratePayroll}
                disabled={payrollLoading}
              >
                {payrollLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.payrollSubmitText}>Generate</Text>
                )}
              </Pressable>
            </View>
            <Text style={styles.payrollHint}>Payroll runs immediately for the selected month.</Text>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={showConvertModal}
        animationType="fade"
        onRequestClose={closeConvertModal}>
        <Pressable
          style={styles.centeredOverlay}
          onPress={closeConvertModal}>
          <Pressable style={styles.convertCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.convertTitle}>Convert Pending User</Text>
            <Text style={styles.convertSubtitle}>{selectedPendingUser?.name || 'Select pending user'}</Text>
            {selectedPendingUser?.email && (
              <Text style={styles.convertMeta}>{selectedPendingUser.email}</Text>
            )}
            <Text style={styles.convertDescription}>
              Assign designation, department, and salary to finalize onboarding.
            </Text>

            <View style={styles.convertFieldGroup}>
              <Text style={styles.convertLabel}>Designation</Text>
              <TextInput
                style={styles.convertInput}
                value={convertDesignation}
                onChangeText={setConvertDesignation}
                placeholder="e.g. Software Developer"
                placeholderTextColor="#94A3B8"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.convertFieldGroup}>
              <Text style={styles.convertLabel}>Department</Text>
              <TextInput
                style={styles.convertInput}
                value={convertDepartment}
                onChangeText={setConvertDepartment}
                placeholder="e.g. Engineering"
                placeholderTextColor="#94A3B8"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.convertFieldGroup}>
              <Text style={styles.convertLabel}>Salary</Text>
              <TextInput
                style={styles.convertInput}
                value={convertSalary}
                onChangeText={setConvertSalary}
                placeholder="50000"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
              />
            </View>

            {convertMessage && (
              <Text
                style={
                  convertMessage.tone === 'success'
                    ? styles.convertMessageSuccess
                    : styles.convertMessageError
                }>
                {convertMessage.text}
              </Text>
            )}

            <View style={styles.convertActions}>
              <Pressable
                style={styles.convertCancel}
                onPress={closeConvertModal}
                disabled={convertLoading}>
                <Text style={styles.convertCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.convertSubmit, convertLoading && styles.convertSubmitDisabled]}
                onPress={handleConvertToEmployee}
                disabled={convertLoading}
              >
                {convertLoading ? (
                  <ActivityIndicator color="#111827" size="small" />
                ) : (
                  <Text style={styles.convertSubmitText}>Convert</Text>
                )}
              </Pressable>
            </View>
            <Text style={styles.convertHint}>Converted users appear instantly in the employee tab.</Text>
          </Pressable>
        </Pressable>
      </Modal>

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
  pendingActionButton: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  pendingActionText: {
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
  staffActionButton: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#111827',
  },
  staffActionText: {
    color: '#111827',
    fontSize: 11,
    fontWeight: '700',
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
  centeredOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 24,
    justifyContent: 'center',
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
  payrollCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  payrollTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  payrollSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 4,
  },
  payrollMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  payrollPickerWrapper: {
    marginTop: 16,
  },
  payrollActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  payrollCancelButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 12,
    alignItems: 'center',
  },
  payrollCancelText: {
    color: '#6B7280',
    fontWeight: '600',
  },
  payrollSubmitButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  payrollSubmitButtonDisabled: {
    opacity: 0.6,
  },
  payrollSubmitText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  payrollMessageSuccess: {
    marginTop: 12,
    color: '#16A34A',
    fontSize: 13,
    fontWeight: '600',
  },
  payrollMessageError: {
    marginTop: 12,
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
  },
  payrollHint: {
    marginTop: 12,
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  convertCard: {
    backgroundColor: '#0F172A',
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 6,
  },
  convertTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  convertSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FDE68A',
    marginTop: 4,
  },
  convertMeta: {
    fontSize: 12,
    color: '#E2E8F0',
    marginTop: 2,
  },
  convertDescription: {
    fontSize: 13,
    color: '#CBD5F5',
    marginTop: 10,
  },
  convertFieldGroup: {
    marginTop: 16,
  },
  convertLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E5E7EB',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  convertInput: {
    borderWidth: 1,
    borderColor: '#2E3A4F',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1F2937',
    color: '#F8FAFC',
  },
  convertActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 20,
  },
  convertCancel: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
    paddingVertical: 12,
    alignItems: 'center',
  },
  convertCancelText: {
    color: '#E2E8F0',
    fontWeight: '600',
  },
  convertSubmit: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#D4A537',
  },
  convertSubmitDisabled: {
    opacity: 0.6,
  },
  convertSubmitText: {
    color: '#111827',
    fontWeight: '700',
  },
  convertMessageSuccess: {
    marginTop: 12,
    color: '#16A34A',
    fontSize: 13,
    fontWeight: '600',
  },
  convertMessageError: {
    marginTop: 12,
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
  },
  convertHint: {
    marginTop: 12,
    fontSize: 12,
    color: '#E2E8F0',
    textAlign: 'center',
  },
});

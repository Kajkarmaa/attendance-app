import SkeletonBlock from '@/components/SkeletonBlock';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Calendar } from 'react-native-calendars';

import { getPayslipDownloadUrl } from '@/services/payroll';
import { fetchEmployeeDetail, type EmployeeDetail } from '@/services/users';

const TABS = ['Overview', 'Attendance', 'Salary', 'Bonus', 'Payslips'] as const;
type TabKey = (typeof TABS)[number];

export default function EmployeeProfileScreen() {
  const params = useLocalSearchParams<{
    name?: string;
    role?: string;
    avatar?: string;
    employeeId?: string;
    division?: string;
    email?: string;
    employeeRecordId?: string | string[];
  }>();

  const [profile, setProfile] = useState<EmployeeDetail | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('Overview');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [payslipDownloading, setPayslipDownloading] = useState(false);

  const recordId = useMemo(() => {
    const value = params.employeeRecordId;
    if (Array.isArray(value)) {
      return value[0];
    }
    return value && value.length > 0 ? value : undefined;
  }, [params.employeeRecordId]);

  const loadProfile = useCallback(async () => {
    console.log(`Loading profile for employeeId=${params.employeeId} recordId=${recordId}`)
    if (!recordId) {
      setProfile(null);
      setError('Missing employee identifier.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchEmployeeDetail(recordId);
      setProfile(data);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Unable to load employee profile.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const fallbackAvatar =
    params.avatar ||
    'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=200&q=80&auto=format&fit=facearea';
  const headerName = profile?.name ?? params.name ?? 'Employee';
  const headerRole = (profile?.designation ?? params.role ?? 'Team Member').toUpperCase();
  const headerDepartment = profile?.department ?? params.division ?? 'Department';
  const headerEmployeeId = profile?.employeeId ?? params.employeeId ?? '--';
  const headerStatus = profile?.status ?? 'Unknown';
  const monthlySalary = typeof profile?.salary === 'number' ? profile.salary : null;
  const salaryDisplay = useMemo(() => {
    if (monthlySalary == null) return '--';
    return `₹${monthlySalary.toLocaleString('en-IN')}`;
  }, [monthlySalary]);

  const joinDateLabel = useMemo(() => {
    const value = profile?.joinDate;
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }, [profile?.joinDate]);

  const leaveBalance = profile?.leaveBalance;
  const leavePercent = useMemo(() => {
    if (!leaveBalance || leaveBalance.total === 0) return 0;
    return Math.min(100, Math.round((leaveBalance.used / leaveBalance.total) * 100));
  }, [leaveBalance]);

  const attendanceSummary = profile?.attendance?.thisMonth;
  const hasPayslips = (profile?.Payslips?.length ?? 0) > 0;

  const latestPayslip = useMemo(() => {
    return profile?.Payslips?.[0];
  }, [profile?.Payslips]);

  const getInitials = (name?: string) => {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + (parts[1][0] ?? '')).slice(0, 2).toUpperCase();
  };

  const extractMonthYear = (payslip: any): { month: number; year: number } | null => {
    if (!payslip) return null;

    const rawMonth = payslip.month;
    const rawYear = payslip.year;

    const monthNum = typeof rawMonth === 'number' ? rawMonth : Number(rawMonth);
    const yearNum = typeof rawYear === 'number' ? rawYear : Number(rawYear);
    if (Number.isFinite(monthNum) && monthNum >= 1 && monthNum <= 12 && Number.isFinite(yearNum) && yearNum >= 2000) {
      return { month: monthNum, year: yearNum };
    }

    if (typeof rawMonth === 'string') {
      const value = rawMonth.trim();
      const match = value.match(/^(\d{4})-(\d{1,2})/);
      if (match) {
        const parsedYear = Number(match[1]);
        const parsedMonth = Number(match[2]);
        if (Number.isFinite(parsedYear) && Number.isFinite(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12) {
          return { month: parsedMonth, year: parsedYear };
        }
      }
    }

    return null;
  };

  // Local calendar state for toggling absent/present per day (YYYY-MM-DD -> 'absent'|'present')
  const [localDayStatus, setLocalDayStatus] = useState<Record<string, 'absent' | 'present'>>({});

  // Initialize localDayStatus from API absentDate array when profile or attendanceSummary changes
  useEffect(() => {
    const obj: Record<string, 'absent' | 'present'> = {};
    try {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      (attendanceSummary?.absentDate || []).forEach((d: number) => {
        if (!Number.isFinite(d)) return;
        const dd = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        obj[dd] = 'absent';
      });
    } catch (e) {
      // ignore
    }
    setLocalDayStatus(obj);
  }, [attendanceSummary]);

  const toggleDayStatus = (dateString: string) => {
    setLocalDayStatus((prev) => {
      const next = { ...prev };
      if (next[dateString] === 'absent') {
        next[dateString] = 'present';
      } else if (next[dateString] === 'present') {
        delete next[dateString];
      } else {
        next[dateString] = 'absent';
      }

      // Also update profile.attendance.thisMonth.absentDate to reflect absents
      const absentDays: number[] = [];
      Object.keys(next).forEach((k) => {
        if (next[k] === 'absent') {
          const parts = k.split('-');
          const day = Number(parts[2]);
          if (Number.isFinite(day)) absentDays.push(day);
        }
      });
      setProfile((prev) => {
        if (!prev) return prev;
        const copy = { ...prev };
        copy.attendance = copy.attendance || { thisMonth: undefined };
        copy.attendance.thisMonth = copy.attendance.thisMonth || {
          present: 0,
          absent: 0,
          late: 0,
          halfDay: 0,
          totalDays: 0,
          averageWorkHours: '0',
          absentDate: [],
        };
        copy.attendance.thisMonth.absentDate = absentDays;
        return copy;
      });

      return next;
    });
  };

  const handleDownloadLatestPayslip = useCallback(async () => {
    if (payslipDownloading) return;
    if (!hasPayslips) return;

    const employeeId = profile?.employeeId || params.employeeId;
    if (!employeeId) {
      Alert.alert('Payslip', 'Missing employee id.');
      return;
    }

    const monthYear = extractMonthYear(latestPayslip);
    if (!monthYear) {
      Alert.alert('Payslip', 'Payslip month/year missing from API response.');
      return;
    }

    setPayslipDownloading(true);
    try {
      const response = await getPayslipDownloadUrl({
        employeeId,
        month: monthYear.month,
        year: monthYear.year,
      });

      if (!response?.success) {
        throw new Error(response?.message || 'Failed to get payslip download url.');
      }

      const url = response?.data?.downloadUrl || response?.data?.payslipUrl;
      if (!url) {
        throw new Error('Download url not found in response.');
      }

      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        throw new Error('Cannot open download url.');
      }
      await Linking.openURL(url);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Unable to download payslip.';
      Alert.alert('Payslip', message);
    } finally {
      setPayslipDownloading(false);
    }
  }, [payslipDownloading, hasPayslips, profile?.employeeId, params.employeeId, latestPayslip]);

  const formatHours = (value?: number | string) => {
    if (typeof value === 'number') {
      return `${value.toFixed(1)}h`;
    }
    if (typeof value === 'string' && value.length > 0) {
      return `${value}h`;
    }
    return '--';
  };

  const formatCurrency = (value?: number | null) => {
    if (typeof value !== 'number') {
      return '--';
    }
    return `₹${value.toLocaleString('en-IN')}`;
  };

  const renderOverview = () => (
    <>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Contact</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{profile?.email ?? params.email ?? 'Not provided'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{profile?.phone ?? 'Not provided'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Department</Text>
            <Text style={styles.infoValue}>{headerDepartment}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Join Date</Text>
            <Text style={styles.infoValue}>{joinDateLabel}</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Employment</Text>
        <View style={styles.infoRow}>
          <View>
            <Text style={styles.infoSmall}>Employee ID</Text>
            <Text style={styles.infoLarge}>{headerEmployeeId}</Text>
          </View>
          <View>
            <Text style={styles.infoSmall}>Base Salary</Text>
            <Text style={styles.infoLarge}>{salaryDisplay}</Text>
          </View>
        </View>
        <View style={[styles.infoRow, { marginTop: 16 }]}> 
          <View>
            <Text style={styles.infoSmall}>Status</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{headerStatus}</Text>
            </View>
          </View>
          <View>
            <Text style={styles.infoSmall}>Role</Text>
            <Text style={styles.infoLarge}>{profile?.role?.toUpperCase() ?? 'EMP'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Leave Balance</Text>
        {leaveBalance ? (
          <>
            <View style={styles.infoRow}>
              <View>
                <Text style={styles.infoSmall}>Total</Text>
                <Text style={styles.infoLarge}>{leaveBalance.total}</Text>
              </View>
              <View>
                <Text style={styles.infoSmall}>Remaining</Text>
                <Text style={styles.infoLarge}>{leaveBalance.remaining}</Text>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${leavePercent}%` }]} />
            </View>
            <Text style={styles.progressCaption}>{leavePercent}% used • {leaveBalance.used} days taken</Text>
          </>
        ) : (
          <Text style={styles.infoValue}>Leave data not available</Text>
        )}
      </View>
    </>
  );

  const renderAttendance = () => {
    if (!attendanceSummary) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No attendance records</Text>
          <Text style={styles.emptySubtitle}>Attendance data will populate after the first check-in.</Text>
        </View>
      );
    }

    const stats = [
      { label: 'Present', value: attendanceSummary.present, color: '#22C55E' },
      { label: 'Absent', value: attendanceSummary.absent, color: '#F97316' },
      { label: 'Late', value: attendanceSummary.late, color: '#FACC15' },
      { label: 'Half Day', value: attendanceSummary.halfDay, color: '#8B5CF6' },
      { label: 'Total Days', value: attendanceSummary.totalDays, color: '#3B82F6' },
      { label: 'Avg Hours', value: attendanceSummary.averageWorkHours, color: '#0EA5E9' },
    ];

    return (
      <View style={styles.attendanceGrid}>
        {stats.map((item) => (
          <View key={item.label} style={styles.attendanceCard}>
            <Text style={[styles.attendanceLabel, { color: item.color }]}>{item.label}</Text>
            <Text style={styles.attendanceValue}>
              {typeof item.value === 'number' || typeof item.value === 'string'
                ? item.label === 'Avg Hours'
                  ? formatHours(item.value as any)
                  : item.value
                : '--'}
            </Text>
          </View>
        ))}
        {/* Calendar showing absent/present days for current month */}
        <View style={{ width: '100%', marginTop: 16 }}>
          <Calendar
            current={new Date().toISOString().slice(0, 10)}
            onDayPress={(day: any) => toggleDayStatus(day.dateString)}
            markingType={'custom'}
            markedDates={Object.keys(localDayStatus).reduce((acc, key) => {
              const status = localDayStatus[key];
              acc[key] = {
                customStyles: {
                  container: {
                    backgroundColor: status === 'absent' ? '#FEE2E2' : '#DCFCE7',
                    borderRadius: 6,
                  },
                  text: {
                    color: status === 'absent' ? '#B91C1C' : '#065F46',
                    fontWeight: '700',
                  },
                },
              } as any;
              return acc;
            }, {} as Record<string, any>)}
          />

          <View style={styles.calendarLegendRow}>
            <View style={styles.calendarLegendItem}>
              <View style={[styles.calendarLegendDot, { backgroundColor: '#DCFCE7' }]} />
              <Text style={styles.calendarLegendText}>Present</Text>
            </View>
            <View style={styles.calendarLegendItem}>
              <View style={[styles.calendarLegendDot, { backgroundColor: '#FEE2E2' }]} />
              <Text style={styles.calendarLegendText}>Absent</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderSalary = () => {
    const annualSalary = monthlySalary ? monthlySalary * 12 : null;
    const latestPayslip = profile?.Payslips?.[0];
    const allowances = [
      { label: 'Housing Support (20%)', value: monthlySalary ? monthlySalary * 0.2 : null },
      { label: 'Travel Allowance (10%)', value: monthlySalary ? monthlySalary * 0.1 : null },
      { label: 'Wellness Stipend (5%)', value: monthlySalary ? monthlySalary * 0.05 : null },
      { label: 'Other Benefits', value: null },
    ];
    const deductions = [
      { label: 'Provident Fund (12%)', value: monthlySalary ? monthlySalary * 0.12 : null },
      { label: 'Professional Tax', value: monthlySalary ? monthlySalary * 0.02 : null },
      { label: 'Insurance', value: null },
      { label: 'Other Deductions', value: null },
    ];

    return (
      <>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Salary Overview</Text>
          <View style={styles.infoRow}>
            <View>
              <Text style={styles.infoSmall}>Monthly Base</Text>
              <Text style={styles.infoLarge}>{formatCurrency(monthlySalary)}</Text>
            </View>
            <View>
              <Text style={styles.infoSmall}>Annualized</Text>
              <Text style={styles.infoLarge}>{formatCurrency(annualSalary)}</Text>
            </View>
          </View>
          <View style={[styles.infoRow, { marginTop: 16 }]}> 
            <View>
              <Text style={styles.infoSmall}>Latest Payslip</Text>
              <Text style={styles.infoLarge}>{latestPayslip?.month ?? 'Not issued'}</Text>
            </View>
            <View>
              <Text style={styles.infoSmall}>Status</Text>
              <View style={styles.salaryTag}>
                <Text style={styles.salaryTagText}>{latestPayslip?.status ?? 'Pending'}</Text>
              </View>
            </View>
          </View>
          <Text style={styles.salaryNote}>Figures sourced from employee detail API. Update actual payouts from payroll.</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Allowances Snapshot</Text>
          <View style={styles.salaryGrid}>
            {allowances.map((item) => (
              <View key={item.label} style={styles.salaryTile}>
                <Text style={styles.salaryLabel}>{item.label}</Text>
                <Text style={styles.salaryValue}>{formatCurrency(item.value)}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.salaryNote}>Allowances are indicative percentages of the base salary.</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Deductions</Text>
          <View style={styles.salaryGrid}>
            {deductions.map((item) => (
              <View key={item.label} style={styles.salaryTile}>
                <Text style={styles.salaryLabel}>{item.label}</Text>
                <Text style={styles.salaryValue}>{formatCurrency(item.value)}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.salaryNote}>Adjust statutory deductions within the payroll console.</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Payout Schedule</Text>
          <View style={styles.salaryRow}>
            <Text style={styles.infoLabel}>Pay Cycle</Text>
            <Text style={styles.infoValue}>Last working day of month</Text>
          </View>
          <View style={styles.salaryRow}>
            <Text style={styles.infoLabel}>Disbursement</Text>
            <Text style={styles.infoValue}>Bank Transfer</Text>
          </View>
          <View style={styles.salaryRow}>
            <Text style={styles.infoLabel}>Next Payroll</Text>
            <Text style={styles.infoValue}>Auto-generates after attendance closure</Text>
          </View>
        </View>
      </>
    );
  };

  const renderBonus = () => {
    const bonuses = profile?.Bonuses ?? [];

    const formatBonusDate = (value?: string) => {
      if (!value) return '—';
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return value;
      return parsed.toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    };

    if (bonuses.length === 0) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No bonus entries yet</Text>
          <Text style={styles.emptySubtitle}>Bonuses added from admin will appear here.</Text>
        </View>
      );
    }

    const totalApproved = bonuses
      .filter((item) => (item.status || '').toLowerCase() === 'approved')
      .reduce((sum, item) => sum + (typeof item.amount === 'number' ? item.amount : 0), 0);

    return (
      <>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Bonus Summary</Text>
          <View style={styles.infoRow}>
            <View>
              <Text style={styles.infoSmall}>Total Entries</Text>
              <Text style={styles.infoLarge}>{bonuses.length}</Text>
            </View>
            <View>
              <Text style={styles.infoSmall}>Approved Total</Text>
              <Text style={styles.infoLarge}>{formatCurrency(totalApproved)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Bonus History</Text>
          {bonuses.map((bonus, index) => (
            <View
              key={bonus.id || `${bonus.type || 'bonus'}-${index}`}
              style={[styles.bonusRow, index !== bonuses.length - 1 && styles.bonusRowDivider]}
            >
              <View style={styles.bonusLeft}>
                <Text style={styles.bonusType}>{(bonus.type || 'bonus').toUpperCase()}</Text>
                <Text style={styles.bonusNote}>{bonus.notes || 'No notes provided'}</Text>
                <Text style={styles.bonusMetaText}>
                  {formatBonusDate(bonus.awardedAt)} • {bonus.awardedBy || 'Admin'}
                </Text>
              </View>
              <View style={styles.bonusRight}>
                <Text style={styles.bonusAmount}>{formatCurrency(bonus.amount)}</Text>
                <View style={styles.salaryTag}>
                  <Text style={styles.salaryTagText}>{bonus.status || 'pending'}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </>
    );
  };

  const renderPayslips = () => {
    if (!hasPayslips) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No payslips yet</Text>
          <Text style={styles.emptySubtitle}>Payroll has not issued any payslips for this employee.</Text>
        </View>
      );
    }

    return (
      <View style={styles.payslipCard}>
        {profile?.Payslips?.map((payslip, index) => (
          <View key={payslip.id || payslip.month || index} style={styles.payslipRow}>
            <View style={styles.payslipIcon}>
              <Feather name="file-text" size={16} color="#D4A537" />
            </View>
            <View style={styles.payslipInfo}>
              <Text style={styles.payslipTitle}>{payslip.month ?? 'Pending period'}</Text>
              <Text style={styles.payslipSub}>{payslip.status ?? 'Draft'}</Text>
            </View>
            <View style={styles.downloadIcon}>
              <Feather name="download" size={14} color="#D4A537" />
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Overview':
        return renderOverview();
      case 'Attendance':
        return renderAttendance();
      case 'Salary':
        return renderSalary();
      case 'Bonus':
        return renderBonus();
      case 'Payslips':
        return renderPayslips();
      default:
        return null;
    }
  };

  if (loading && !profile) {
    return (
      <View style={styles.loadingState}>
        <View style={[styles.profileCard, { alignItems: 'center' }]}>
          <View style={styles.avatarRing}>
            <SkeletonBlock width={74} height={74} borderRadius={37} />
          </View>
          <SkeletonBlock style={{ marginTop: 12 }} width={140} height={18} borderRadius={8} />
          <SkeletonBlock style={{ marginTop: 8 }} width={100} height={12} borderRadius={8} />
          <SkeletonBlock style={{ marginTop: 8 }} width={180} height={10} borderRadius={8} />
        </View>

        <View style={{ width: '100%', paddingHorizontal: 20, marginTop: 20 }}>
          <SkeletonBlock height={14} width="60%" style={{ marginBottom: 12 }} />
          <SkeletonBlock height={14} width="80%" style={{ marginBottom: 12 }} />
          <SkeletonBlock height={14} width="40%" style={{ marginBottom: 12 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Feather name="chevron-left" size={20} color="#111111" />
        </Pressable>
        <Text style={styles.headerTitle}>EMPLOYEE PROFILE</Text>
        <Pressable style={styles.moreButton} onPress={loadProfile}>
          <Feather name="refresh-cw" size={18} color="#111111" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatarRing}>
            {profile?.profilePicture ? (
              <Image source={{ uri: profile.profilePicture }} style={styles.avatar} />
            ) : (
              <View style={styles.placeholderInitials}>
                <Text style={styles.placeholderInitialsText}>{getInitials(headerName)}</Text>
              </View>
            )}
          </View>
          <Text style={styles.name}>{headerName}</Text>
          <Text style={styles.role}>{headerRole}</Text>
          <Text style={styles.meta}>ID: {headerEmployeeId}  •  {headerDepartment}</Text>

          <View style={styles.tabsRow}>
            {TABS.map((tab) => {
              const isActive = tab === activeTab;
              return (
                <Pressable key={tab} style={styles.tabItem} onPress={() => setActiveTab(tab)}>
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab}</Text>
                  {isActive ? <View style={styles.tabUnderline} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={loadProfile}>
              <Text style={styles.errorAction}>Retry</Text>
            </Pressable>
          </View>
        )}

        {loading && profile ? (
          <View style={styles.inlineLoader}>
            <ActivityIndicator size="small" color="#D4A537" />
            <Text style={styles.inlineLoaderText}>Refreshing...</Text>
          </View>
        ) : null}

        {renderTabContent()}
      </ScrollView>

      <Pressable
        style={[
          styles.bottomButton,
          (!hasPayslips || payslipDownloading) && styles.bottomButtonDisabled,
        ]}
        disabled={!hasPayslips || payslipDownloading}
        onPress={handleDownloadLatestPayslip}
      >
        {payslipDownloading ? (
          <ActivityIndicator size="small" color="#111111" />
        ) : (
          <Feather name="download" size={16} color={hasPayslips ? '#D4A537' : '#9CA3AF'} />
        )}
        <Text style={[styles.bottomButtonText, (!hasPayslips || payslipDownloading) && styles.bottomButtonTextDisabled]}>
          {!hasPayslips
            ? 'NO PAYSLIPS TO DOWNLOAD'
            : payslipDownloading
              ? 'PREPARING DOWNLOAD...'
              : 'DOWNLOAD LATEST PAYSLIP'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F2',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 12,
  },
  backButton: {
    height: 36,
    width: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  moreButton: {
    height: 36,
    width: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#111111',
    fontWeight: '600',
    letterSpacing: 1,
    fontSize: 12,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  avatarRing: {
    height: 86,
    width: 86,
    borderRadius: 43,
    borderWidth: 2,
    borderColor: '#D4A537',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatar: {
    height: 74,
    width: 74,
    borderRadius: 37,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  role: {
    fontSize: 11,
    color: '#D4A537',
    marginTop: 4,
    letterSpacing: 1,
  },
  meta: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
  },
  tabsRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 18,
  },
  tabItem: {
    alignItems: 'center',
  },
  tabText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  tabTextActive: {
    color: '#111111',
    fontWeight: '600',
  },
  tabUnderline: {
    marginTop: 6,
    height: 2,
    width: 36,
    backgroundColor: '#D4A537',
    borderRadius: 999,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F2E7C2',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 12,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoItem: {
    width: '48%',
  },
  infoLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    letterSpacing: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoSmall: {
    fontSize: 10,
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  infoLarge: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
    marginTop: 2,
  },
  statusBadge: {
    marginTop: 4,
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    color: '#15803D',
    fontWeight: '600',
  },
  progressTrack: {
    marginTop: 12,
    height: 6,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
  },
  progressFill: {
    height: 6,
    borderRadius: 4,
    backgroundColor: '#D4A537',
  },
  progressCaption: {
    marginTop: 8,
    fontSize: 11,
    color: '#6B7280',
  },
  attendanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  attendanceCard: {
    width: '47%',
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  attendanceLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  attendanceValue: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
  },
  salaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  salaryTile: {
    width: '48%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  salaryLabel: {
    fontSize: 11,
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  salaryValue: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  salaryNote: {
    marginTop: 10,
    fontSize: 11,
    color: '#6B7280',
  },
  salaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  salaryTag: {
    marginTop: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  salaryTagText: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '600',
  },
  bonusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  bonusRowDivider: {
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
  },
  bonusLeft: {
    flex: 1,
    paddingRight: 10,
  },
  bonusRight: {
    alignItems: 'flex-end',
  },
  bonusType: {
    fontSize: 11,
    color: '#D4A537',
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  bonusNote: {
    marginTop: 4,
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
  },
  bonusMetaText: {
    marginTop: 4,
    fontSize: 11,
    color: '#6B7280',
  },
  bonusAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  emptyCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7C2D12',
  },
  emptySubtitle: {
    fontSize: 11,
    color: '#9A3412',
    marginTop: 6,
  },
  payslipCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F2E7C2',
    gap: 10,
  },
  payslipRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  payslipIcon: {
    height: 30,
    width: 30,
    borderRadius: 15,
    backgroundColor: '#FFF6DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payslipInfo: {
    flex: 1,
    marginLeft: 10,
  },
  payslipTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111111',
  },
  payslipSub: {
    fontSize: 9,
    color: '#9CA3AF',
    marginTop: 2,
  },
  downloadIcon: {
    height: 26,
    width: 26,
    borderRadius: 13,
    backgroundColor: '#FFF6DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    flex: 1,
    color: '#7F1D1D',
    fontSize: 12,
  },
  errorAction: {
    color: '#B91C1C',
    fontWeight: '600',
  },
  inlineLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  inlineLoaderText: {
    color: '#6B7280',
    fontSize: 12,
  },
  bottomButton: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: '#0B0B0B',
    borderRadius: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  bottomButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  bottomButtonText: {
    color: '#D4A537',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  bottomButtonTextDisabled: {
    color: '#6B7280',
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F6F2',
  },
  loadingLabel: {
    marginTop: 12,
    color: '#6B7280',
  },
  placeholderInitials: {
    height: 74,
    width: 74,
    borderRadius: 37,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderInitialsText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111111',
  },
  calendarLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 16,
  },
  calendarLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calendarLegendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  calendarLegendText: {
    fontSize: 12,
    color: '#6B7280',
  },
});

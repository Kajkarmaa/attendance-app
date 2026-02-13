import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function EmployeeProfileScreen() {
  const params = useLocalSearchParams<{
    name?: string;
    role?: string;
    avatar?: string;
    employeeId?: string;
    division?: string;
  }>();

  const name = params.name ?? 'Rajesh Kapoor';
  const role = (params.role ?? 'Senior Gemologist').toUpperCase();
  const avatar =
    params.avatar ??
    'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=200&q=80&auto=format&fit=facearea';
  const employeeId = params.employeeId ?? 'EMP-9283';
  const division = params.division ?? 'Luxury Division';

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Feather name="chevron-left" size={20} color="#111111" />
        </Pressable>
        <Text style={styles.headerTitle}>EMPLOYEE PROFILE</Text>
        <Pressable style={styles.moreButton}>
          <Feather name="more-vertical" size={18} color="#111111" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatarRing}>
            <Image
              source={{
                uri: avatar,
              }}
              style={styles.avatar}
            />
          </View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.role}>{role}</Text>
          <Text style={styles.meta}>ID: {employeeId}  •  {division}</Text>

          <View style={styles.tabsRow}>
            {['Overview', 'Attendance', 'Salary','Bonus', 'Docs'].map((tab, index) => (
              <View key={tab} style={styles.tabItem}>
                <Text style={[styles.tabText, index === 2 && styles.tabTextActive]}>{tab}</Text>
                {index === 2 ? <View style={styles.tabUnderline} /> : null}
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Monthly Earnings Overview</Text>
        <View style={styles.earningsCard}>
          <View style={styles.earningsRow}>
            <View>
              <Text style={styles.earningsLabel}>LAST MONTH TOTAL</Text>
              <Text style={styles.earningsValue}>₹75,000</Text>
            </View>
            <View style={styles.changePill}>
              <Text style={styles.changeText}>▲ 5.2%</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.earningsRow}>
            <View>
              <Text style={styles.earningsLabel}>YEAR-TO-DATE</Text>
              <Text style={styles.earningsValue}>₹9,00,000</Text>
            </View>
            <View style={styles.changePill}>
              <Text style={styles.changeText}>▲ 8.0%</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Recent Payslips</Text>
        <View style={styles.payslipCard}>
          {['August 2023', 'July 2023', 'June 2023'].map((item) => (
            <View key={item} style={styles.payslipRow}>
              <View style={styles.payslipIcon}>
                <Feather name="file-text" size={16} color="#D4A537" />
              </View>
              <View style={styles.payslipInfo}>
                <Text style={styles.payslipTitle}>{item}</Text>
                <Text style={styles.payslipSub}>Paid on 01 Sep</Text>
              </View>
              <View style={styles.downloadIcon}>
                <Feather name="download" size={14} color="#D4A537" />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <Pressable style={styles.bottomButton}>
        <Feather name="download" size={16} color="#D4A537" />
        <Text style={styles.bottomButtonText}>DOWNLOAD MONTHLY REPORT</Text>
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
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 10,
  },
  earningsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#F2E7C2',
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  earningsLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    letterSpacing: 1,
  },
  earningsValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111111',
    marginTop: 4,
  },
  changePill: {
    backgroundColor: '#E7F6EC',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  changeText: {
    fontSize: 10,
    color: '#16A34A',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
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
  bottomButtonText: {
    color: '#D4A537',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
});

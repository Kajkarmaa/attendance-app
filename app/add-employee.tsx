import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

export default function AddEmployeeScreen() {
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [salary, setSalary] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [kycFileName, setKycFileName] = useState<string | null>(null);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow photo access to upload a profile image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handlePickKyc = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });

    if (!result.canceled) {
      const asset = result.assets?.[0];
      if (asset?.name) {
        setKycFileName(asset.name);
      } else {
        setKycFileName('Selected file');
      }
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Feather name="chevron-left" size={22} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.headerTitle}>Add New Employee</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.card}>
            <View style={styles.profileBlock}>
              <Pressable style={styles.profileCircle} onPress={handlePickImage}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.profileImage} />
                ) : (
                  <Feather name="user" size={22} color="#D4A537" />
                )}
              </Pressable>
              <Pressable style={styles.cameraBadge} onPress={handlePickImage}>
                <Feather name="camera" size={14} color="#111111" />
              </Pressable>
              <Text style={styles.profileText}>PROFILE IDENTITY</Text>
            </View>

            <Text style={styles.label}>EMPLOYEE NAME</Text>
            
            <TextInput
              style={styles.input}
              placeholder="e.g. Julianne Moretti"
              placeholderTextColor="#A0A0A0"
              value={name}
              onChangeText={setName}
            />

            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.label}>EMPLOYEE ID</Text>
                <TextInput
                  style={styles.input}
                  placeholder="EMP-2024"
                  placeholderTextColor="#A0A0A0"
                  value={employeeId}
                  onChangeText={setEmployeeId}
                />
              </View>
              <View style={styles.halfField}>
                <Text style={styles.label}>MONTHLY SALARY</Text>
                <TextInput
                  style={styles.input}
                  placeholder="₹ 0.00"
                  placeholderTextColor="#A0A0A0"
                  value={salary}
                  onChangeText={setSalary}
                />
              </View>
            </View>

            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <TextInput
              style={styles.input}
              placeholder="julianne@luxury.com"
              placeholderTextColor="#A0A0A0"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.label}>PHONE NUMBER</Text>
            <TextInput
              style={styles.input}
              placeholder="+1 (555) 000-0000"
              placeholderTextColor="#A0A0A0"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

            <Text style={styles.label}>WHATSAPP NUMBER</Text>
            <TextInput
              style={styles.input}
              placeholder="+1 (555) 000-0000"
              placeholderTextColor="#A0A0A0"
              keyboardType="phone-pad"
              value={whatsapp}
              onChangeText={setWhatsapp}
            />

            <Text style={styles.label}>KYC DOCUMENTS</Text>
            <Pressable style={styles.uploadCard} onPress={handlePickKyc}>
              <View style={styles.uploadIcon}>
                <Feather name="upload" size={14} color="#D4A537" />
              </View>
              <View style={styles.uploadTextBlock}>
                <Text style={styles.uploadTitle}>UPLOAD ID PROOF</Text>
                <Text style={styles.uploadSubtitle}>
                  {kycFileName ?? 'PDF, JPG (MAX 5MB)'}
                </Text>
              </View>
              <View style={styles.uploadPlus}>
                <Feather name="plus" size={16} color="#D4A537" />
              </View>
            </Pressable>
          </View>

          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryText}>ADD EMPLOYEE</Text>
            <Feather name="arrow-right" size={16} color="#D4A537" />
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1F1F1F',
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    height: 36,
    width: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 36,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  profileBlock: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileCircle: {
    height: 74,
    width: 74,
    borderRadius: 37,
    borderWidth: 1,
    borderColor: '#E8D9A3',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileImage: {
    height: 74,
    width: 74,
    borderRadius: 37,
  },
  cameraBadge: {
    position: 'absolute',
    right: 118,
    top: 48,
    height: 26,
    width: 26,
    borderRadius: 13,
    backgroundColor: '#D4A537',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: {
    marginTop: 10,
    fontSize: 10,
    letterSpacing: 2,
    color: '#4B5563',
  },
  label: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E8D9A3',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  uploadCard: {
    marginTop: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E8D9A3',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadIcon: {
    height: 28,
    width: 28,
    borderRadius: 14,
    backgroundColor: '#F9F5E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTextBlock: {
    flex: 1,
    marginLeft: 10,
  },
  uploadTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2F2F2F',
  },
  uploadSubtitle: {
    fontSize: 9,
    color: '#9CA3AF',
    marginTop: 2,
  },
  uploadPlus: {
    height: 26,
    width: 26,
    borderRadius: 13,
    backgroundColor: '#F9F5E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    marginTop: 18,
    backgroundColor: '#0B0B0B',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: {
    color: '#D4A537',
    fontWeight: '600',
    letterSpacing: 1,
  },
});

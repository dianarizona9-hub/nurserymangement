import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import api from '../utils/api';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

interface Stats {
  total_received: number;
  total_dead: number;
  total_discarded: number;
  total_produced: number;
  total_distributed: number;
  survival_rate: number;
  total_in_nursery: number;
}

export default function Dashboard() {
  const { username, logout } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await api.get('/dashboard/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
      Alert.alert('Error', 'Failed to load statistics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await api.get('/export/csv', {
        responseType: 'blob',
      });
      
      const filename = `nursery_data_${new Date().toISOString().split('T')[0]}.csv`;
      const fileUri = FileSystem.documentDirectory + filename;
      
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(response.data);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const base64 = base64data.split(',')[1];
        
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
        } else {
          Alert.alert('Success', `File saved to ${fileUri}`);
        }
      };
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.username}>{username}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.sectionTitle}>Overview Statistics</Text>

        <View style={styles.row}>
          <View style={[styles.card, styles.primaryCard]}>
            <Ionicons name="leaf" size={32} color="#4CAF50" />
            <Text style={styles.cardValue}>{stats?.total_in_nursery || 0}</Text>
            <Text style={styles.cardLabel}>Total in Nursery</Text>
          </View>

          <View style={[styles.card, styles.successCard]}>
            <Ionicons name="heart" size={32} color="#2196F3" />
            <Text style={styles.cardValue}>{stats?.survival_rate || 0}%</Text>
            <Text style={styles.cardLabel}>Survival Rate</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.smallCard}>
            <Ionicons name="download" size={24} color="#4CAF50" />
            <Text style={styles.smallCardValue}>{stats?.total_received || 0}</Text>
            <Text style={styles.smallCardLabel}>Received</Text>
          </View>

          <View style={styles.smallCard}>
            <Ionicons name="add-circle" size={24} color="#FF9800" />
            <Text style={styles.smallCardValue}>{stats?.total_produced || 0}</Text>
            <Text style={styles.smallCardLabel}>Produced</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.smallCard}>
            <Ionicons name="alert-circle" size={24} color="#F44336" />
            <Text style={styles.smallCardValue}>{stats?.total_dead || 0}</Text>
            <Text style={styles.smallCardLabel}>Dead</Text>
          </View>

          <View style={styles.smallCard}>
            <Ionicons name="trash" size={24} color="#9E9E9E" />
            <Text style={styles.smallCardValue}>{stats?.total_discarded || 0}</Text>
            <Text style={styles.smallCardLabel}>Discarded</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.smallCard}>
            <Ionicons name="share-social" size={24} color="#9C27B0" />
            <Text style={styles.smallCardValue}>{stats?.total_distributed || 0}</Text>
            <Text style={styles.smallCardLabel}>Distributed</Text>
          </View>

          <View style={styles.smallCard} />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.exportButton, exporting && styles.exportButtonDisabled]}
        onPress={handleExport}
        disabled={exporting}
      >
        <Ionicons name="download-outline" size={20} color="#fff" />
        <Text style={styles.exportButtonText}>
          {exporting ? 'Exporting...' : 'Export Data to CSV'}
        </Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Pull down to refresh</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4CAF50',
    padding: 24,
    paddingTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
  },
  statsContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryCard: {
    backgroundColor: '#E8F5E9',
  },
  successCard: {
    backgroundColor: '#E3F2FD',
  },
  cardValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
  },
  cardLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  smallCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  smallCardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  smallCardLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  exportButton: {
    backgroundColor: '#4CAF50',
    margin: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportButtonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    padding: 24,
  },
  footerText: {
    color: '#999',
    fontSize: 14,
  },
});

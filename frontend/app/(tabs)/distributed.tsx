import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DatePicker from 'react-native-date-picker';
import api from '../utils/api';

interface DistributedSeedling {
  _id: string;
  date: string;
  type: string;
  quantity: number;
  destination: string;
  location: string;
}

export default function Distributed() {
  const [seedlings, setSeedlings] = useState<DistributedSeedling[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    date: new Date(),
    type: '',
    quantity: '',
    destination: '',
    location: '',
  });

  useEffect(() => {
    loadSeedlings();
  }, []);

  const loadSeedlings = async () => {
    try {
      const response = await api.get('/distributed-seedlings');
      setSeedlings(response.data);
    } catch (error) {
      console.error('Error loading seedlings:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.type || !formData.quantity || !formData.destination || !formData.location) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      await api.post('/distributed-seedlings', {
        date: formData.date.toISOString().split('T')[0],
        type: formData.type,
        quantity: parseInt(formData.quantity),
        destination: formData.destination,
        location: formData.location,
        user_id: 'temp',
      });
      
      setModalVisible(false);
      resetForm();
      loadSeedlings();
      Alert.alert('Success', 'Record added successfully');
    } catch (error) {
      console.error('Error adding seedling:', error);
      Alert.alert('Error', 'Failed to add record');
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Record', 'Are you sure you want to delete this record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/distributed-seedlings/${id}`);
            loadSeedlings();
            Alert.alert('Success', 'Record deleted');
          } catch (error) {
            Alert.alert('Error', 'Failed to delete record');
          }
        },
      },
    ]);
  };

  const resetForm = () => {
    setFormData({
      date: new Date(),
      type: '',
      quantity: '',
      destination: '',
      location: '',
    });
  };

  const renderItem = ({ item }: { item: DistributedSeedling }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Ionicons name="share-social" size={24} color="#9C27B0" />
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>{item.type}</Text>
            <Text style={styles.cardDate}>{item.date}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => handleDelete(item._id)} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={20} color="#F44336" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Quantity:</Text>
          <Text style={styles.infoValue}>{item.quantity}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Destination:</Text>
          <Text style={styles.infoValue}>{item.destination}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Location:</Text>
          <Text style={styles.infoValue}>{item.location}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={seedlings}
        renderItem={renderItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadSeedlings(); }} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="alert-circle-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No records yet</Text>
            <Text style={styles.emptySubtext}>Tap the + button to add a record</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Distributed Seedlings</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form}>
              <TouchableOpacity style={styles.dateInput} onPress={() => setDatePickerOpen(true)}>
                <Text style={styles.inputText}>
                  {formData.date.toISOString().split('T')[0]}
                </Text>
                <Ionicons name="calendar-outline" size={20} color="#666" />
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                placeholder="Seedling Type"
                value={formData.type}
                onChangeText={(text) => setFormData({ ...formData, type: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="Quantity"
                value={formData.quantity}
                onChangeText={(text) => setFormData({ ...formData, quantity: text })}
                keyboardType="number-pad"
              />

              <TextInput
                style={styles.input}
                placeholder="Destination (e.g., Enrichment Site, Agroforestry)"
                value={formData.destination}
                onChangeText={(text) => setFormData({ ...formData, destination: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="Location/Address"
                value={formData.location}
                onChangeText={(text) => setFormData({ ...formData, location: text })}
              />

              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                <Text style={styles.submitButtonText}>Add Record</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <DatePicker
        modal
        open={datePickerOpen}
        date={formData.date}
        mode="date"
        onConfirm={(date) => {
          setDatePickerOpen(false);
          setFormData({ ...formData, date });
        }}
        onCancel={() => setDatePickerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderText: {
    marginLeft: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cardDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
  },
  cardBody: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 64,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  form: {
    padding: 20,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dateInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputText: {
    fontSize: 16,
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#F44336',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

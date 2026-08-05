import axiosInstance from '../../../api/axiosInstance';

export async function getApsConfiguration() {
  const { data } = await axiosInstance.get('/aps/configuration');
  return data;
}

export async function saveApsConfiguration(configuration) {
  const { data } = await axiosInstance.put('/aps/configuration', configuration);
  return data;
}

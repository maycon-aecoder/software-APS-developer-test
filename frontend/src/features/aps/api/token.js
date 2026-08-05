import axiosInstance from '../../../api/axiosInstance';

export async function requestViewerToken() {
  const { data } = await axiosInstance.post('/aps/token');
  return data;
}

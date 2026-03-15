import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
});

export const getMetadata = async () => {
  const response = await client.get('/meta');
  return response.data;
};

export const getSpatialData = async (variable, timeRange) => {
  const [startIdx, endIdx] = Array.isArray(timeRange) ? timeRange : [timeRange, timeRange];
  const response = await client.get('/spatial', {
    params: { variable, start_time_index: startIdx, end_time_index: endIdx }
  });
  return response.data;
};

export const getTimeSeries = async (variable, lat, lon) => {
  const response = await client.get('/timeseries', {
    params: { variable, lat, lon }
  });
  return response.data;
};

export const getStats = async (variable) => {
  const response = await client.get('/stats', {
    params: { variable }
  });
  return response.data;
};

export const getDatasetInfo = async () => {
  const response = await client.get('/info');
  return response.data;
};

export default client;

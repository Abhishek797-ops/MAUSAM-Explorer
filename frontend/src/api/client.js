import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
});

export const getMetadata = async () => {
  const response = await client.get('/meta');
  return response.data;
};

export const getSpatialData = async (variable, timeIndex) => {
  const response = await client.get('/spatial', {
    params: { variable, time_index: timeIndex }
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

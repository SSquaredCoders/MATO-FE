import axios from 'axios';
import { MapFormData } from '../types/mapSetp1';

const API_BASE_URL = 'http://localhost:8080';

export const createMap = async (formData: MapFormData, accessToken: string) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/api/maps`, formData, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        return { success: true, data: response.data };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : '맵 생성 중 오류가 발생했습니다.'
        };
    }
};

export const updateMap = async (formData: MapFormData & { id: string }, accessToken: string) => {
    try {
        const response = await axios.patch(`${API_BASE_URL}/api/maps/${formData.id}`, formData, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        return { success: true, data: response.data };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : '맵 수정 중 오류가 발생했습니다.'
        };
    }
};

export const getMap = async (mapId: string, accessToken: string) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/maps/${mapId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        return { success: true, data: response.data };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : '맵 조회 중 오류가 발생했습니다.'
        };
    }
};

export const getMyMaps = async (accessToken: string) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/maps/my`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        return { success: true, data: response.data };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : '내 맵 목록 조회 중 오류가 발생했습니다.'
        };
    }
};

export const deleteMap = async (mapId: string, accessToken: string) => {
    try {
        await axios.delete(`${API_BASE_URL}/api/maps/${mapId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : '맵 삭제 중 오류가 발생했습니다.'
        };
    }
}; 
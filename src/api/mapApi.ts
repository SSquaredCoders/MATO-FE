import axios from 'axios';
import { MapFormData } from '../types/mapSetp1';
import { API_BASE_URL } from '../contants/env';

// 새 맵 생성 (POST /api/maps)
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

// 맵 이름 중복 확인 (GET /api/maps/check)
export const checkMapExists = async (name: string) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/maps/check`, {
            params: { name }
        });
        return { success: true, data: response.data };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : '맵 이름 중복 확인 중 오류가 발생했습니다.'
        };
    }
};

// 특정 맵 정보 조회 (GET /api/maps/{id})
export const getMap = async (mapId: string | number) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/maps/${mapId}`);
        return { success: true, data: response.data };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : '맵 조회 중 오류가 발생했습니다.'
        };
    }
};

// 모든 공개된 맵 조회 (GET /api/maps/public)
export const getPublicMaps = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/maps/public`);
        return { success: true, data: response.data };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : '공개 맵 목록 조회 중 오류가 발생했습니다.'
        };
    }
};

// 사용자별 맵 목록 조회 (GET /api/maps/user/{userId})
export const getUserMaps = async (userId: string, accessToken: string) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/maps/user/${userId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        return { success: true, data: response.data };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : '사용자 맵 목록 조회 중 오류가 발생했습니다.'
        };
    }
};

// 내 맵 목록 조회 (사용자 ID를 통한 조회)
export const getMyMaps = async (accessToken: string, userId: string) => {
    return getUserMaps(userId, accessToken);
};

// 맵 정보 수정 (PATCH /api/maps/{mapId})
export const updateMap = async (mapId: string | number, formData: MapFormData, accessToken: string) => {
    try {
        const response = await axios.patch(`${API_BASE_URL}/api/maps/${mapId}`, formData, {
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

// 맵 삭제 (DELETE /api/maps/{id})
export const deleteMap = async (mapId: string | number, accessToken: string) => {
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
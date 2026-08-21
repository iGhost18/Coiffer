import api from "../api"; // Adjust the import path as needed

export async function fetchStaff() {
    try {
        const res = await api.get("/api/staff/map");

        if (!Array.isArray(res.data)) {
            console.error("Invalid /api/staff/map response:", res.data);
            return [];
        }

        return res.data.map((staff) => ({
            ...staff,
            online: false,
            socketId: null,
        }));
    } catch (err) {
        console.error("Failed to fetch /api/staff/map:", err);
        return [];
    }
}
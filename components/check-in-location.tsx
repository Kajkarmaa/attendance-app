import * as Location from "expo-location";
import { useState } from "react";

export interface CheckInLocationData {
    locationLat: number;
    locationLng: number;
    locationCity: string;
    locationState: string;
}

const DEFAULT_LOCATION_TEXT = "Unknown";

export function useCheckInLocation() {
    const [isGettingLocation, setIsGettingLocation] = useState(false);

    const getCheckInLocation = async (): Promise<CheckInLocationData> => {
        setIsGettingLocation(true);

        try {
            const permission =
                await Location.requestForegroundPermissionsAsync();

            if (permission.status !== "granted") {
                throw new Error(
                    "Location permission is required to check in.",
                );
            }

            const position = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            const [address] = await Location.reverseGeocodeAsync({
                latitude,
                longitude,
            });

            return {
                locationLat: latitude,
                locationLng: longitude,
                locationCity:
                    address?.city ||
                    address?.subregion ||
                    address?.district ||
                    DEFAULT_LOCATION_TEXT,
                locationState: address?.region || DEFAULT_LOCATION_TEXT,
            };
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }

            throw new Error("Unable to get your current location.");
        } finally {
            setIsGettingLocation(false);
        }
    };

    return {
        getCheckInLocation,
        isGettingLocation,
    };
}
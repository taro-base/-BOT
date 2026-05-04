
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin, Check } from 'lucide-react';

// Fix for default marker icon in Leaflet + React
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapEventsProps {
  position: [number, number];
  setPosition: (pos: [number, number]) => void;
  reverseGeocode: (lat: number, lon: number) => void;
}

function LocationMarker({ position, setPosition, reverseGeocode }: MapEventsProps) {
  const map = useMap();
  
  useMapEvents({
    click(e) {
      const newPos: [number, number] = [e.latlng.lat, e.latlng.lng];
      setPosition(newPos);
      reverseGeocode(e.latlng.lat, e.latlng.lng);
    },
  });

  // Only fly when position changes and is significantly different from current center
  useEffect(() => {
    const center = map.getCenter();
    const distance = Math.sqrt(
      Math.pow(center.lat - position[0], 2) + 
      Math.pow(center.lng - position[1], 2)
    );
    
    if (distance > 0.0001) { // Threshold to prevent tiny jitter fly
      map.flyTo(position, map.getZoom());
    }
  }, [position, map]);

  return position === null ? null : (
    <Marker position={position}></Marker>
  );
}

interface MapPickerProps {
  onSelect: (address: string) => void;
  onCancel: () => void;
}

const MapPicker: React.FC<MapPickerProps> = ({ onSelect, onCancel }) => {
  const [position, setPosition] = useState<[number, number]>([35.6812, 139.7671]); // Tokyo Station
  const [searchQuery, setSearchQuery] = useState('');
  const [address, setAddress] = useState('地図をクリックして場所を選択してください');
  const [isLoading, setIsLoading] = useState(false);

  // Get current location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newPos: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setPosition(newPos);
        },
        (err) => console.warn("Geolocation failed", err)
      );
    }
  }, []);

  const formatJapaneseAddress = (addressDetails: any) => {
    if (!addressDetails) return '';
    
    // Components of a Japanese address
    const postcode = addressDetails.postcode ? `〒${addressDetails.postcode} ` : '';
    const state = addressDetails.province || addressDetails.state || '';
    const city = addressDetails.city || addressDetails.town || addressDetails.village || addressDetails.city_district || '';
    const suburb = addressDetails.suburb || addressDetails.neighbourhood || '';
    const road = addressDetails.road || '';
    const houseNumber = addressDetails.house_number || '';
    const building = addressDetails.building || addressDetails.amenity || addressDetails.shop || addressDetails.office || '';
    
    // Combine them in Japanese order
    let formatted = `${postcode}${state}${city}${suburb}${road}${houseNumber}`;
    if (building) {
      formatted += ` ${building}`;
    }
    
    return formatted || '住所が見つかりませんでした';
  };

  const reverseGeocode = async (lat: number, lon: number) => {
    setIsLoading(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`, {
        headers: { 'Accept-Language': 'ja' }
      });
      const data = await response.json();
      const formattedAddress = formatJapaneseAddress(data.address);
      setAddress(formattedAddress);
    } catch (err) {
      setAddress(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    setIsLoading(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&addressdetails=1`, {
        headers: { 'Accept-Language': 'ja' }
      });
      const data = await response.json();
      if (data && data.length > 0) {
        const newPos: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        setPosition(newPos);
        const formattedAddress = formatJapaneseAddress(data[0].address);
        setAddress(formattedAddress);
      }
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[400px] bg-white rounded-2xl overflow-hidden border border-gray-200">
      <div className="p-3 border-b border-gray-100 flex flex-col gap-2">
        <form onSubmit={handleSearch} className="relative flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="住所や場所を検索..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-green-500 transition-all font-sans"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button 
              type="submit"
              className="absolute left-2 top-1.5 p-1 hover:bg-gray-200 rounded-md transition-colors text-gray-400 hover:text-green-600"
              title="検索"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
          <button
            type="submit"
            disabled={isLoading || !searchQuery}
            className="px-4 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition-all disabled:opacity-50 whitespace-nowrap"
          >
            検索
          </button>
        </form>
        <div className="flex items-start gap-2 text-xs text-gray-600 bg-green-50 p-2 rounded-lg">
          <MapPin className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
          <span className="line-clamp-2">{isLoading ? '取得中...' : address}</span>
        </div>
      </div>

      <div className="flex-1 relative z-0">
        <MapContainer center={position} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker position={position} setPosition={setPosition} reverseGeocode={reverseGeocode} />
        </MapContainer>
      </div>

      <div className="p-3 flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-semibold hover:bg-gray-200 transition-all text-sm"
        >
          戻る
        </button>
        <button
          onClick={() => onSelect(address)}
          disabled={isLoading || address === '地図をクリックして場所を選択してください'}
          className="flex-2 py-3 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          この場所に決定
        </button>
      </div>
    </div>
  );
};

export default MapPicker;

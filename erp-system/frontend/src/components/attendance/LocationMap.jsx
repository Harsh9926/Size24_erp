import React from 'react';
import { MapPin, ExternalLink } from 'lucide-react';
import { googleMapsLink, osmEmbed } from './attendanceUtils';

// Keyless map preview (OpenStreetMap embed) + "Open in Google Maps" link.
const LocationMap = ({ lat, lng, height = 180, label = 'Location' }) => {
    if (lat == null || lng == null) {
        return <div className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> No location captured</div>;
    }
    return (
        <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border-color)' }}>
            <iframe
                title={label}
                src={osmEmbed(Number(lat), Number(lng))}
                className="w-full block"
                style={{ height, border: 0 }}
                loading="lazy"
            />
            <a href={googleMapsLink(lat, lng)} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors">
                <ExternalLink className="h-3.5 w-3.5" /> Open in Google Maps
                <span className="text-gray-500 font-normal">({Number(lat).toFixed(5)}, {Number(lng).toFixed(5)})</span>
            </a>
        </div>
    );
};

export default LocationMap;

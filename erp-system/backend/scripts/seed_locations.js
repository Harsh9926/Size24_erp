const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Client } = require('pg');

const STATES_AND_CITIES = [
    { state: 'Andhra Pradesh', cities: ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Tirupati', 'Rajahmundry', 'Kakinada', 'Eluru', 'Ongole'] },
    { state: 'Arunachal Pradesh', cities: ['Itanagar', 'Naharlagun', 'Pasighat', 'Tawang', 'Ziro'] },
    { state: 'Assam', cities: ['Guwahati', 'Dibrugarh', 'Silchar', 'Jorhat', 'Nagaon', 'Tinsukia', 'Tezpur', 'Bongaigaon'] },
    { state: 'Bihar', cities: ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga', 'Purnia', 'Arrah', 'Begusarai', 'Katihar', 'Munger'] },
    { state: 'Chhattisgarh', cities: ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg', 'Rajnandgaon', 'Jagdalpur', 'Ambikapur'] },
    { state: 'Goa', cities: ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda', 'Bicholim'] },
    { state: 'Gujarat', cities: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Gandhinagar', 'Junagadh', 'Anand', 'Navsari', 'Morbi', 'Mehsana'] },
    { state: 'Haryana', cities: ['Faridabad', 'Gurugram', 'Panipat', 'Ambala', 'Yamunanagar', 'Rohtak', 'Hisar', 'Karnal', 'Sonipat', 'Panchkula', 'Bhiwani'] },
    { state: 'Himachal Pradesh', cities: ['Shimla', 'Manali', 'Dharamshala', 'Solan', 'Mandi', 'Kullu', 'Baddi', 'Nahan', 'Palampur'] },
    { state: 'Jharkhand', cities: ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Deoghar', 'Phusro', 'Hazaribagh', 'Giridih', 'Ramgarh'] },
    { state: 'Karnataka', cities: ['Bengaluru', 'Mysuru', 'Hubli', 'Mangaluru', 'Belagavi', 'Kalaburagi', 'Davanagere', 'Ballari', 'Tumakuru', 'Shivamogga', 'Raichur', 'Bidar', 'Udupi'] },
    { state: 'Kerala', cities: ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam', 'Palakkad', 'Alappuzha', 'Malappuram', 'Kannur', 'Kasaragod', 'Kottayam'] },
    { state: 'Madhya Pradesh', cities: ['Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Dewas', 'Satna', 'Ratlam', 'Rewa', 'Murwara', 'Singrauli'] },
    { state: 'Maharashtra', cities: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Solapur', 'Thane', 'Kolhapur', 'Amravati', 'Nanded', 'Sangli', 'Malegaon', 'Jalgaon', 'Akola', 'Latur', 'Dhule', 'Ahmednagar'] },
    { state: 'Manipur', cities: ['Imphal', 'Thoubal', 'Bishnupur', 'Churachandpur', 'Kakching'] },
    { state: 'Meghalaya', cities: ['Shillong', 'Tura', 'Jowai', 'Nongstoin', 'Williamnagar'] },
    { state: 'Mizoram', cities: ['Aizawl', 'Lunglei', 'Champhai', 'Serchhip', 'Kolasib'] },
    { state: 'Nagaland', cities: ['Kohima', 'Dimapur', 'Mokokchung', 'Tuensang', 'Wokha'] },
    { state: 'Odisha', cities: ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri', 'Balasore', 'Bhadrak', 'Baripada', 'Jharsuguda'] },
    { state: 'Punjab', cities: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali', 'Hoshiarpur', 'Batala', 'Pathankot', 'Moga', 'Firozpur'] },
    { state: 'Rajasthan', cities: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Bikaner', 'Ajmer', 'Alwar', 'Bhilwara', 'Sikar', 'Sri Ganganagar', 'Pali', 'Barmer', 'Tonk'] },
    { state: 'Sikkim', cities: ['Gangtok', 'Namchi', 'Gyalshing', 'Mangan', 'Rangpo'] },
    { state: 'Tamil Nadu', cities: ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Erode', 'Vellore', 'Thoothukudi', 'Dindigul', 'Thanjavur', 'Ranipet', 'Sivakasi', 'Karur'] },
    { state: 'Telangana', cities: ['Hyderabad', 'Warangal', 'Nizamabad', 'Khammam', 'Karimnagar', 'Ramagundam', 'Mahbubnagar', 'Nalgonda', 'Adilabad', 'Suryapet'] },
    { state: 'Tripura', cities: ['Agartala', 'Udaipur', 'Dharmanagar', 'Kailasahar', 'Belonia'] },
    { state: 'Uttar Pradesh', cities: ['Lucknow', 'Kanpur', 'Varanasi', 'Agra', 'Prayagraj', 'Meerut', 'Ghaziabad', 'Noida', 'Mathura', 'Bareilly', 'Aligarh', 'Moradabad', 'Saharanpur', 'Gorakhpur', 'Firozabad', 'Jhansi', 'Muzaffarnagar', 'Rampur', 'Shahjahanpur', 'Farrukhabad'] },
    { state: 'Uttarakhand', cities: ['Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Nainital', 'Rishikesh', 'Mussoorie', 'Kashipur', 'Rudrapur', 'Kotdwar'] },
    { state: 'West Bengal', cities: ['Kolkata', 'Asansol', 'Siliguri', 'Durgapur', 'Howrah', 'Bardhaman', 'Malda', 'Baharampur', 'Habra', 'Kharagpur', 'Shantipur', 'Dankuni', 'Dhulian'] },
    { state: 'Andaman and Nicobar Islands', cities: ['Port Blair', 'Diglipur', 'Rangat'] },
    { state: 'Chandigarh', cities: ['Chandigarh'] },
    { state: 'Dadra and Nagar Haveli and Daman and Diu', cities: ['Daman', 'Diu', 'Silvassa'] },
    { state: 'Delhi', cities: ['New Delhi', 'Dwarka', 'Rohini', 'Janakpuri', 'Lajpat Nagar', 'Saket', 'Pitampura', 'Karol Bagh', 'Connaught Place', 'Shahdara'] },
    { state: 'Jammu and Kashmir', cities: ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Sopore', 'Kathua', 'Udhampur'] },
    { state: 'Ladakh', cities: ['Leh', 'Kargil'] },
    { state: 'Lakshadweep', cities: ['Kavaratti', 'Agatti', 'Amini'] },
    { state: 'Puducherry', cities: ['Puducherry', 'Karaikal', 'Mahe', 'Yanam'] },
];

async function seedLocations(client) {
    const existing = await client.query('SELECT COUNT(*) FROM states');
    if (parseInt(existing.rows[0].count) > 0) {
        console.log(`States already seeded (${existing.rows[0].count} found). Skipping.`);
        return false;
    }

    console.log('Seeding states and cities...');
    for (const { state, cities } of STATES_AND_CITIES) {
        const stateResult = await client.query(
            'INSERT INTO states (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id',
            [state]
        );
        const stateId = stateResult.rows[0].id;

        for (const city of cities) {
            await client.query(
                'INSERT INTO cities (state_id, name) VALUES ($1, $2) ON CONFLICT (state_id, name) DO NOTHING',
                [stateId, city]
            );
        }
        process.stdout.write(`  ✓ ${state} (${cities.length} cities)\n`);
    }
    console.log(`\nSeeded ${STATES_AND_CITIES.length} states and ${STATES_AND_CITIES.reduce((a, s) => a + s.cities.length, 0)} cities.`);
    return true;
}

// Run standalone
if (require.main === module) {
    (async () => {
        const client = new Client({
            user: process.env.DB_USER,
            host: process.env.DB_HOST || 'localhost',
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT || 5432,
        });
        try {
            await client.connect();
            await seedLocations(client);
        } catch (err) {
            console.error('Seed error:', err.message);
            process.exit(1);
        } finally {
            await client.end();
        }
    })();
}

module.exports = { seedLocations };

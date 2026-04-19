const db = require('../config/db');

exports.getAllLocations = async (req, res) => {
    try {
        const [states, cities] = await Promise.all([
            db.query('SELECT id, name FROM states ORDER BY name ASC'),
            db.query('SELECT id, name, state_id FROM cities ORDER BY name ASC'),
        ]);
        res.json({ states: states.rows, cities: cities.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createState = async (req, res) => {
    try {
        const { name } = req.body;
        const result = await db.query(
            'INSERT INTO states (name) VALUES ($1) RETURNING *',
            [name]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getStates = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM states ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createCity = async (req, res) => {
    try {
        const { state_id, name } = req.body;
        const result = await db.query(
            'INSERT INTO cities (state_id, name) VALUES ($1, $2) RETURNING *',
            [state_id, name]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getCitiesByState = async (req, res) => {
    try {
        const { stateId } = req.params;
        const result = await db.query(
            'SELECT * FROM cities WHERE state_id = $1 ORDER BY name ASC',
            [stateId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

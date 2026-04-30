--
-- PostgreSQL database dump
--

\restrict hMjsOszBCB2VqXfqoLDP4yuh6USmJ8DpofxN7Dlw7xIN0KsXs7LoOXJiolNceMP

-- Dumped from database version 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    table_name character varying(50) NOT NULL,
    record_id integer NOT NULL,
    old_value jsonb,
    new_value jsonb,
    edited_by integer,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: cash_flows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cash_flows (
    id integer NOT NULL,
    shop_id integer,
    amount numeric(12,2) NOT NULL,
    type character varying(20),
    done_by character varying(100),
    note text,
    date date NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cash_flows_type_check CHECK (((type)::text = ANY ((ARRAY['deposit'::character varying, 'expense'::character varying])::text[])))
);


ALTER TABLE public.cash_flows OWNER TO postgres;

--
-- Name: cash_flows_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cash_flows_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cash_flows_id_seq OWNER TO postgres;

--
-- Name: cash_flows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cash_flows_id_seq OWNED BY public.cash_flows.id;


--
-- Name: cash_transfers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cash_transfers (
    id integer NOT NULL,
    from_user_id integer NOT NULL,
    to_user_id integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    note text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cash_transfers_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT cash_transfers_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT no_self_transfer CHECK ((from_user_id <> to_user_id))
);


ALTER TABLE public.cash_transfers OWNER TO postgres;

--
-- Name: cash_transfers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cash_transfers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cash_transfers_id_seq OWNER TO postgres;

--
-- Name: cash_transfers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cash_transfers_id_seq OWNED BY public.cash_transfers.id;


--
-- Name: cities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cities (
    id integer NOT NULL,
    state_id integer,
    name character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.cities OWNER TO postgres;

--
-- Name: cities_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cities_id_seq OWNER TO postgres;

--
-- Name: cities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cities_id_seq OWNED BY public.cities.id;


--
-- Name: daily_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_entries (
    id integer NOT NULL,
    shop_id integer,
    date date NOT NULL,
    total_sale numeric(12,2) DEFAULT 0,
    cash numeric(12,2) DEFAULT 0,
    online numeric(12,2) DEFAULT 0,
    paytm numeric(12,2) DEFAULT 0,
    razorpay numeric(12,2) DEFAULT 0,
    locked boolean DEFAULT false,
    edit_enabled_till timestamp without time zone,
    photo_url text,
    submitted_lat numeric(10,7),
    submitted_lng numeric(10,7),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    approval_status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    excel_total_sale numeric(12,2) DEFAULT 0,
    approved_by integer,
    approved_at timestamp without time zone,
    rejection_note text,
    CONSTRAINT daily_entries_approval_status_check CHECK (((approval_status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[])))
);


ALTER TABLE public.daily_entries OWNER TO postgres;

--
-- Name: daily_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.daily_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.daily_entries_id_seq OWNER TO postgres;

--
-- Name: daily_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.daily_entries_id_seq OWNED BY public.daily_entries.id;


--
-- Name: excel_uploads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.excel_uploads (
    id integer NOT NULL,
    user_id integer,
    shop_id integer,
    filename text NOT NULL,
    upload_date date NOT NULL,
    total_sale numeric(14,2) DEFAULT 0 NOT NULL,
    row_data jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.excel_uploads OWNER TO postgres;

--
-- Name: excel_uploads_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.excel_uploads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.excel_uploads_id_seq OWNER TO postgres;

--
-- Name: excel_uploads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.excel_uploads_id_seq OWNED BY public.excel_uploads.id;


--
-- Name: manager_transfers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.manager_transfers (
    id integer NOT NULL,
    manager_id integer NOT NULL,
    to_admin_id integer,
    amount numeric(12,2) NOT NULL,
    type character varying(30) NOT NULL,
    note text,
    receipt_url text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    approved_by integer,
    approved_at timestamp without time zone,
    rejection_note text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT manager_transfers_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT manager_transfers_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT manager_transfers_type_check CHECK (((type)::text = ANY ((ARRAY['manager_to_admin'::character varying, 'manager_to_bank'::character varying])::text[])))
);


ALTER TABLE public.manager_transfers OWNER TO postgres;

--
-- Name: manager_transfers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.manager_transfers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.manager_transfers_id_seq OWNER TO postgres;

--
-- Name: manager_transfers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.manager_transfers_id_seq OWNED BY public.manager_transfers.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer,
    type character varying(50) NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: shops; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shops (
    id integer NOT NULL,
    state_id integer,
    city_id integer,
    shop_name character varying(150) NOT NULL,
    gst_number character varying(15),
    shop_address text,
    manager_name character varying(100),
    mobile_number character varying(15),
    document_type character varying(50),
    document_number character varying(50),
    user_id integer,
    latitude numeric(10,7),
    longitude numeric(10,7),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT shops_document_type_check CHECK (((document_type)::text = ANY ((ARRAY['aadhaar'::character varying, 'pan'::character varying, 'voter'::character varying])::text[])))
);


ALTER TABLE public.shops OWNER TO postgres;

--
-- Name: shops_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.shops_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shops_id_seq OWNER TO postgres;

--
-- Name: shops_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.shops_id_seq OWNED BY public.shops.id;


--
-- Name: states; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.states (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.states OWNER TO postgres;

--
-- Name: states_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.states_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.states_id_seq OWNER TO postgres;

--
-- Name: states_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.states_id_seq OWNED BY public.states.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.users (
    id integer NOT NULL,
    mobile character varying(15) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(50) NOT NULL,
    name character varying(100),
    is_approved boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    wallet_balance numeric(12,2) DEFAULT 0 NOT NULL,
    deleted_at timestamp without time zone,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'shop_user'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO admin;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO admin;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: cash_flows id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_flows ALTER COLUMN id SET DEFAULT nextval('public.cash_flows_id_seq'::regclass);


--
-- Name: cash_transfers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_transfers ALTER COLUMN id SET DEFAULT nextval('public.cash_transfers_id_seq'::regclass);


--
-- Name: cities id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cities ALTER COLUMN id SET DEFAULT nextval('public.cities_id_seq'::regclass);


--
-- Name: daily_entries id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_entries ALTER COLUMN id SET DEFAULT nextval('public.daily_entries_id_seq'::regclass);


--
-- Name: excel_uploads id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.excel_uploads ALTER COLUMN id SET DEFAULT nextval('public.excel_uploads_id_seq'::regclass);


--
-- Name: manager_transfers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.manager_transfers ALTER COLUMN id SET DEFAULT nextval('public.manager_transfers_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: shops id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shops ALTER COLUMN id SET DEFAULT nextval('public.shops_id_seq'::regclass);


--
-- Name: states id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.states ALTER COLUMN id SET DEFAULT nextval('public.states_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, table_name, record_id, old_value, new_value, edited_by, "timestamp") FROM stdin;
1	daily_entries	1	{"id": 1, "cash": "10000.00", "date": "2026-04-19T00:00:00.000Z", "paytm": "0.00", "locked": false, "online": "20000.00", "shop_id": 1, "razorpay": "9547.00", "photo_url": null, "created_at": "2026-04-19T10:58:17.551Z", "total_sale": "39547.00", "approved_at": null, "approved_by": null, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "PENDING", "excel_total_sale": "39547.00", "edit_enabled_till": null}	{"id": 1, "cash": "10000.00", "date": "2026-04-19T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "20000.00", "shop_id": 1, "razorpay": "9547.00", "photo_url": null, "created_at": "2026-04-19T10:58:17.551Z", "total_sale": "39547.00", "approved_at": "2026-04-19T10:59:28.451Z", "approved_by": 1, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "39547.00", "edit_enabled_till": null}	1	2026-04-19 10:59:28.453529
2	daily_entries	6	{"id": 6, "cash": "2000.00", "date": "2026-04-20T00:00:00.000Z", "paytm": "0.00", "locked": false, "online": "2000.00", "shop_id": 1, "razorpay": "787.00", "photo_url": null, "created_at": "2026-04-20T07:17:31.483Z", "total_sale": "4787.00", "approved_at": null, "approved_by": null, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "PENDING", "excel_total_sale": "4787.00", "edit_enabled_till": null}	{"id": 6, "cash": "2000.00", "date": "2026-04-20T00:00:00.000Z", "paytm": "0.00", "locked": false, "online": "2000.00", "shop_id": 1, "razorpay": "787.00", "photo_url": null, "created_at": "2026-04-20T07:17:31.483Z", "total_sale": "4787.00", "approved_at": "2026-04-20T17:06:30.287Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": "Wron", "approval_status": "REJECTED", "excel_total_sale": "4787.00", "edit_enabled_till": null}	3	2026-04-20 17:06:30.289883
3	daily_entries	6	{"id": 6, "cash": "2000.00", "date": "2026-04-20T00:00:00.000Z", "paytm": "0.00", "locked": false, "online": "2000.00", "shop_id": 1, "razorpay": "787.00", "photo_url": null, "created_at": "2026-04-20T07:17:31.483Z", "total_sale": "4787.00", "approved_at": "2026-04-20T17:06:30.287Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": "Wron", "approval_status": "REJECTED", "excel_total_sale": "4787.00", "edit_enabled_till": null}	{"cash": "2000.00", "date": "2026-04-20", "online": "787", "razorpay": "2000", "photo_url": null, "excel_total_sale": "4787.00"}	2	2026-04-20 17:41:31.413521
4	daily_entries	6	{"id": 6, "cash": "2000.00", "date": "2026-04-20T00:00:00.000Z", "paytm": "0.00", "locked": false, "online": "787.00", "shop_id": 1, "razorpay": "2000.00", "photo_url": null, "created_at": "2026-04-20T07:17:31.483Z", "total_sale": "4787.00", "approved_at": "2026-04-20T17:06:30.287Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": "Wron", "approval_status": "PENDING", "excel_total_sale": "4787.00", "edit_enabled_till": null}	{"id": 6, "cash": "2000.00", "date": "2026-04-20T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "787.00", "shop_id": 1, "razorpay": "2000.00", "photo_url": null, "created_at": "2026-04-20T07:17:31.483Z", "total_sale": "4787.00", "approved_at": "2026-04-20T18:09:13.070Z", "approved_by": 1, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "4787.00", "edit_enabled_till": null}	1	2026-04-20 18:09:13.070115
5	daily_entries	6	{"id": 6, "cash": "2000.00", "date": "2026-04-20T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "787.00", "shop_id": 1, "razorpay": "2000.00", "photo_url": null, "created_at": "2026-04-20T07:17:31.483Z", "total_sale": "4787.00", "approved_at": "2026-04-20T18:09:13.070Z", "approved_by": 1, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "4787.00", "edit_enabled_till": null}	{"action": "deleted"}	1	2026-04-26 10:52:26.80667
6	daily_entries	1	{"id": 1, "cash": "10000.00", "date": "2026-04-19T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "20000.00", "shop_id": 1, "razorpay": "9547.00", "photo_url": null, "created_at": "2026-04-19T10:58:17.551Z", "total_sale": "39547.00", "approved_at": "2026-04-19T10:59:28.451Z", "approved_by": 1, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "39547.00", "edit_enabled_till": "2026-04-19T18:11:41.670Z"}	{"action": "deleted"}	1	2026-04-26 10:52:28.986501
7	daily_entries	7	{}	{"id": 7, "cash": "2805.00", "date": "2026-04-05T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "155109.00", "shop_id": 2, "razorpay": "3100.00", "photo_url": null, "created_at": "2026-04-27T06:09:54.741Z", "total_sale": "161014.00", "approved_at": "2026-04-27T06:09:54.741Z", "approved_by": 1, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "161014.00", "edit_enabled_till": null}	1	2026-04-27 06:09:54.741692
8	daily_entries	8	{}	{"id": 8, "cash": "7000.00", "date": "2026-04-05T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "131485.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T06:38:18.714Z", "total_sale": "138485.00", "approved_at": "2026-04-27T06:38:18.714Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "138485.00", "edit_enabled_till": null}	3	2026-04-27 06:38:18.714371
9	daily_entries	9	{}	{"id": 9, "cash": "18800.00", "date": "2026-04-06T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "110017.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T07:15:32.217Z", "total_sale": "128817.00", "approved_at": "2026-04-27T07:15:32.217Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "128817.00", "edit_enabled_till": null}	3	2026-04-27 07:15:32.217272
10	daily_entries	10	{}	{"id": 10, "cash": "14400.00", "date": "2026-04-07T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "129061.00", "shop_id": 1, "razorpay": "0.25", "photo_url": null, "created_at": "2026-04-27T07:17:24.653Z", "total_sale": "143461.25", "approved_at": "2026-04-27T07:17:24.653Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "143461.25", "edit_enabled_till": null}	3	2026-04-27 07:17:24.653486
11	daily_entries	11	{}	{"id": 11, "cash": "2970.00", "date": "2026-04-08T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "53495.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T07:18:37.444Z", "total_sale": "56465.00", "approved_at": "2026-04-27T07:18:37.444Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "56465.00", "edit_enabled_till": null}	3	2026-04-27 07:18:37.444917
12	daily_entries	12	{}	{"id": 12, "cash": "600.00", "date": "2026-04-09T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "18570.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T07:20:03.155Z", "total_sale": "19170.00", "approved_at": "2026-04-27T07:20:03.155Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "19170.00", "edit_enabled_till": null}	3	2026-04-27 07:20:03.15509
13	daily_entries	13	{}	{"id": 13, "cash": "0.00", "date": "2026-04-10T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "6931.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T07:21:46.410Z", "total_sale": "6931.00", "approved_at": "2026-04-27T07:21:46.410Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "6931.00", "edit_enabled_till": null}	3	2026-04-27 07:21:46.410674
14	daily_entries	14	{}	{"id": 14, "cash": "4800.00", "date": "2026-04-11T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "34573.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T07:23:42.111Z", "total_sale": "39373.00", "approved_at": "2026-04-27T07:23:42.111Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "39373.00", "edit_enabled_till": null}	3	2026-04-27 07:23:42.111713
15	daily_entries	15	{}	{"id": 15, "cash": "9479.00", "date": "2026-04-12T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "48997.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T07:27:36.750Z", "total_sale": "58476.00", "approved_at": "2026-04-27T07:27:36.750Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "58476.00", "edit_enabled_till": null}	3	2026-04-27 07:27:36.750847
16	daily_entries	16	{}	{"id": 16, "cash": "170.00", "date": "2026-04-13T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "33183.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T07:28:44.243Z", "total_sale": "33353.00", "approved_at": "2026-04-27T07:28:44.243Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "33353.00", "edit_enabled_till": null}	3	2026-04-27 07:28:44.243879
17	daily_entries	17	{}	{"id": 17, "cash": "0.00", "date": "2026-04-14T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "21899.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T07:30:59.056Z", "total_sale": "21899.00", "approved_at": "2026-04-27T07:30:59.056Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "21899.00", "edit_enabled_till": null}	3	2026-04-27 07:30:59.056188
18	daily_entries	18	{}	{"id": 18, "cash": "0.00", "date": "2026-04-15T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "860.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T07:32:40.072Z", "total_sale": "860.00", "approved_at": "2026-04-27T07:32:40.072Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "860.00", "edit_enabled_till": null}	3	2026-04-27 07:32:40.072203
19	daily_entries	19	{}	{"id": 19, "cash": "4926.00", "date": "2026-04-16T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "10964.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T07:33:50.408Z", "total_sale": "15890.00", "approved_at": "2026-04-27T07:33:50.408Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "15890.00", "edit_enabled_till": null}	3	2026-04-27 07:33:50.408107
20	daily_entries	20	{}	{"id": 20, "cash": "0.00", "date": "2026-04-17T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "2336.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T07:34:50.722Z", "total_sale": "2336.00", "approved_at": "2026-04-27T07:34:50.722Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "2336.00", "edit_enabled_till": null}	3	2026-04-27 07:34:50.722017
21	daily_entries	21	{}	{"id": 21, "cash": "0.00", "date": "2026-04-18T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "32947.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T07:35:36.286Z", "total_sale": "32947.00", "approved_at": "2026-04-27T07:35:36.286Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "32947.00", "edit_enabled_till": null}	3	2026-04-27 07:35:36.286948
22	daily_entries	22	{}	{"id": 22, "cash": "0.00", "date": "2026-04-19T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "30314.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T07:37:20.938Z", "total_sale": "30314.00", "approved_at": "2026-04-27T07:37:20.938Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "30314.00", "edit_enabled_till": null}	3	2026-04-27 07:37:20.93846
23	daily_entries	23	{}	{"id": 23, "cash": "0.00", "date": "2026-04-20T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "15068.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T07:38:19.329Z", "total_sale": "15068.00", "approved_at": "2026-04-27T07:38:19.329Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "15068.00", "edit_enabled_till": null}	3	2026-04-27 07:38:19.329914
24	daily_entries	24	{}	{"id": 24, "cash": "440.00", "date": "2026-04-21T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "10229.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T07:39:16.666Z", "total_sale": "10669.00", "approved_at": "2026-04-27T07:39:16.666Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "10669.00", "edit_enabled_till": null}	3	2026-04-27 07:39:16.66609
25	daily_entries	25	{}	{"id": 25, "cash": "100.00", "date": "2026-04-22T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "1670.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T07:40:21.130Z", "total_sale": "1770.00", "approved_at": "2026-04-27T07:40:21.130Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "1770.00", "edit_enabled_till": null}	3	2026-04-27 07:40:21.130348
26	daily_entries	26	{}	{"id": 26, "cash": "160.00", "date": "2026-04-23T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "3680.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T07:43:45.581Z", "total_sale": "3840.00", "approved_at": "2026-04-27T07:43:45.581Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "3840.00", "edit_enabled_till": null}	3	2026-04-27 07:43:45.5816
27	daily_entries	27	{}	{"id": 27, "cash": "10.00", "date": "2026-04-24T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "0.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T07:44:31.193Z", "total_sale": "10.00", "approved_at": "2026-04-27T07:44:31.193Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "10.00", "edit_enabled_till": null}	3	2026-04-27 07:44:31.193973
28	daily_entries	28	{}	{"id": 28, "cash": "0.00", "date": "2026-04-25T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "9540.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T07:45:43.470Z", "total_sale": "9540.00", "approved_at": "2026-04-27T07:45:43.470Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "9540.00", "edit_enabled_till": null}	3	2026-04-27 07:45:43.470539
29	daily_entries	29	{}	{"id": 29, "cash": "700.00", "date": "2026-04-26T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "8708.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T07:47:44.057Z", "total_sale": "9408.00", "approved_at": "2026-04-27T07:47:44.057Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "9408.00", "edit_enabled_till": null}	3	2026-04-27 07:47:44.057905
30	daily_entries	30	{}	{"id": 30, "cash": "15020.00", "date": "2026-04-06T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "106603.00", "shop_id": 2, "razorpay": "24844.00", "photo_url": null, "created_at": "2026-04-27T07:54:53.593Z", "total_sale": "146467.00", "approved_at": "2026-04-27T07:54:53.593Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "146467.00", "edit_enabled_till": null}	3	2026-04-27 07:54:53.593442
31	daily_entries	31	{}	{"id": 31, "cash": "0.00", "date": "2026-04-07T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "249784.00", "shop_id": 2, "razorpay": "33860.00", "photo_url": null, "created_at": "2026-04-27T07:57:38.630Z", "total_sale": "283644.00", "approved_at": "2026-04-27T07:57:38.630Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "283644.00", "edit_enabled_till": null}	3	2026-04-27 07:57:38.630542
32	daily_entries	32	{}	{"id": 32, "cash": "5335.00", "date": "2026-04-08T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "49470.00", "shop_id": 2, "razorpay": "746.00", "photo_url": null, "created_at": "2026-04-27T08:00:51.676Z", "total_sale": "55551.00", "approved_at": "2026-04-27T08:00:51.676Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "55551.00", "edit_enabled_till": null}	3	2026-04-27 08:00:51.676014
33	daily_entries	33	{}	{"id": 33, "cash": "2065.00", "date": "2026-04-09T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "58157.00", "shop_id": 2, "razorpay": "3017.00", "photo_url": null, "created_at": "2026-04-27T08:02:18.015Z", "total_sale": "63239.00", "approved_at": "2026-04-27T08:02:18.015Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "63239.00", "edit_enabled_till": null}	3	2026-04-27 08:02:18.015805
34	daily_entries	34	{}	{"id": 34, "cash": "5500.00", "date": "2026-04-10T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "23865.00", "shop_id": 2, "razorpay": "6.00", "photo_url": null, "created_at": "2026-04-27T08:03:47.691Z", "total_sale": "29371.00", "approved_at": "2026-04-27T08:03:47.691Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "29371.00", "edit_enabled_till": null}	3	2026-04-27 08:03:47.691984
35	daily_entries	35	{}	{"id": 35, "cash": "30346.00", "date": "2026-04-11T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "90032.00", "shop_id": 2, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T08:05:26.494Z", "total_sale": "120378.00", "approved_at": "2026-04-27T08:05:26.494Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "120378.00", "edit_enabled_till": null}	3	2026-04-27 08:05:26.494406
36	daily_entries	36	{}	{"id": 36, "cash": "3090.00", "date": "2026-04-12T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "76379.00", "shop_id": 2, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T08:06:49.306Z", "total_sale": "79469.00", "approved_at": "2026-04-27T08:06:49.306Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "79469.00", "edit_enabled_till": null}	3	2026-04-27 08:06:49.306416
37	daily_entries	37	{}	{"id": 37, "cash": "429.00", "date": "2026-04-13T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "6512.00", "shop_id": 2, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T08:08:16.933Z", "total_sale": "6941.00", "approved_at": "2026-04-27T08:08:16.933Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "6941.00", "edit_enabled_till": null}	3	2026-04-27 08:08:16.933988
38	daily_entries	38	{}	{"id": 38, "cash": "425.00", "date": "2026-04-14T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "33307.00", "shop_id": 2, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T08:09:15.558Z", "total_sale": "33732.00", "approved_at": "2026-04-27T08:09:15.558Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "33732.00", "edit_enabled_till": null}	3	2026-04-27 08:09:15.558087
39	daily_entries	39	{}	{"id": 39, "cash": "540.00", "date": "2026-04-15T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "7850.00", "shop_id": 2, "razorpay": "2529.00", "photo_url": null, "created_at": "2026-04-27T08:10:41.158Z", "total_sale": "10919.00", "approved_at": "2026-04-27T08:10:41.158Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "10919.00", "edit_enabled_till": null}	3	2026-04-27 08:10:41.158823
40	daily_entries	40	{}	{"id": 40, "cash": "5640.00", "date": "2026-04-16T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "35315.00", "shop_id": 2, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T08:11:45.306Z", "total_sale": "40955.00", "approved_at": "2026-04-27T08:11:45.306Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "40955.00", "edit_enabled_till": null}	3	2026-04-27 08:11:45.306078
41	daily_entries	41	{}	{"id": 41, "cash": "1599.00", "date": "2026-04-17T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "30.00", "shop_id": 2, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T08:12:53.259Z", "total_sale": "1629.00", "approved_at": "2026-04-27T08:12:53.259Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "1629.00", "edit_enabled_till": null}	3	2026-04-27 08:12:53.259608
42	daily_entries	42	{}	{"id": 42, "cash": "5600.00", "date": "2026-04-18T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "0.00", "shop_id": 2, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T08:14:28.487Z", "total_sale": "27597.00", "approved_at": "2026-04-27T08:14:28.487Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "27597.00", "edit_enabled_till": null}	3	2026-04-27 08:14:28.487165
43	daily_entries	43	{}	{"id": 43, "cash": "2570.00", "date": "2026-04-19T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "48035.00", "shop_id": 2, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T09:40:20.813Z", "total_sale": "50605.00", "approved_at": "2026-04-27T09:40:20.813Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "50605.00", "edit_enabled_till": null}	3	2026-04-27 09:40:20.81366
44	daily_entries	44	{}	{"id": 44, "cash": "3145.00", "date": "2026-04-20T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "34277.00", "shop_id": 2, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T09:43:05.904Z", "total_sale": "37422.00", "approved_at": "2026-04-27T09:43:05.904Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "37422.00", "edit_enabled_till": null}	3	2026-04-27 09:43:05.90419
45	daily_entries	45	{}	{"id": 45, "cash": "0.00", "date": "2026-04-21T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "59336.80", "shop_id": 2, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T09:44:17.877Z", "total_sale": "59336.80", "approved_at": "2026-04-27T09:44:17.877Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "59336.80", "edit_enabled_till": null}	3	2026-04-27 09:44:17.877296
46	daily_entries	46	{}	{"id": 46, "cash": "0.00", "date": "2026-04-22T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "9809.00", "shop_id": 2, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T09:45:17.121Z", "total_sale": "9809.00", "approved_at": "2026-04-27T09:45:17.121Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "9809.00", "edit_enabled_till": null}	3	2026-04-27 09:45:17.121945
47	daily_entries	47	{}	{"id": 47, "cash": "0.00", "date": "2026-04-23T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "4141.00", "shop_id": 2, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T09:46:03.805Z", "total_sale": "4141.00", "approved_at": "2026-04-27T09:46:03.805Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "4141.00", "edit_enabled_till": null}	3	2026-04-27 09:46:03.805723
48	daily_entries	48	{}	{"id": 48, "cash": "0.00", "date": "2026-04-24T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "9425.00", "shop_id": 2, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T09:47:10.457Z", "total_sale": "9425.00", "approved_at": "2026-04-27T09:47:10.457Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "9425.00", "edit_enabled_till": null}	3	2026-04-27 09:47:10.45744
49	daily_entries	49	{}	{"id": 49, "cash": "0.00", "date": "2026-04-25T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "6650.00", "shop_id": 2, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T09:47:55.717Z", "total_sale": "6650.00", "approved_at": "2026-04-27T09:47:55.717Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "6650.00", "edit_enabled_till": null}	3	2026-04-27 09:47:55.7171
50	daily_entries	50	{}	{"id": 50, "cash": "0.00", "date": "2026-04-26T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "26490.00", "shop_id": 2, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T09:49:07.008Z", "total_sale": "26490.00", "approved_at": "2026-04-27T09:49:07.008Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "26490.00", "edit_enabled_till": null}	3	2026-04-27 09:49:07.008617
51	daily_entries	42	{"id": 42, "cash": "5600.00", "date": "2026-04-18T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "0.00", "shop_id": 2, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T08:14:28.487Z", "total_sale": "27597.00", "approved_at": "2026-04-27T08:14:28.487Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "27597.00", "edit_enabled_till": "2026-04-27T12:22:38.099Z"}	{"id": 42, "cash": "5600.00", "date": "2026-04-18T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "21997.00", "shop_id": 2, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T08:14:28.487Z", "total_sale": "27597.00", "approved_at": "2026-04-27T08:14:28.487Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "27597.00", "edit_enabled_till": "2026-04-27T12:22:38.099Z"}	3	2026-04-27 12:27:19.595116
52	daily_entries	51	{"id": 51, "cash": "0.00", "date": "2026-04-27T00:00:00.000Z", "paytm": "0.00", "locked": false, "online": "1020.00", "shop_id": 2, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T14:24:23.659Z", "total_sale": "1020.00", "approved_at": null, "approved_by": null, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "PENDING", "excel_total_sale": "1020.00", "edit_enabled_till": null}	{"id": 51, "cash": "0.00", "date": "2026-04-27T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "1020.00", "shop_id": 2, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-27T14:24:23.659Z", "total_sale": "1020.00", "approved_at": "2026-04-27T17:07:26.846Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "1020.00", "edit_enabled_till": null}	3	2026-04-27 17:07:26.846638
53	daily_entries	52	{}	{"id": 52, "cash": "0.00", "date": "2026-04-01T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "25266.00", "shop_id": 2, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-28T06:18:21.277Z", "total_sale": "25266.00", "approved_at": "2026-04-28T06:18:21.277Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "25266.00", "edit_enabled_till": null}	3	2026-04-28 06:18:21.277627
54	daily_entries	53	{}	{"id": 53, "cash": "0.00", "date": "2026-04-02T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "39699.00", "shop_id": 2, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-28T06:18:59.896Z", "total_sale": "39699.00", "approved_at": "2026-04-28T06:18:59.896Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "39699.00", "edit_enabled_till": null}	3	2026-04-28 06:18:59.896702
55	daily_entries	54	{}	{"id": 54, "cash": "0.00", "date": "2026-04-03T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "38253.00", "shop_id": 2, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-28T06:19:35.836Z", "total_sale": "38253.00", "approved_at": "2026-04-28T06:19:35.836Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "38253.00", "edit_enabled_till": null}	3	2026-04-28 06:19:35.836887
56	daily_entries	55	{}	{"id": 55, "cash": "0.00", "date": "2026-04-04T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "148971.05", "shop_id": 2, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-28T06:22:17.199Z", "total_sale": "148971.05", "approved_at": "2026-04-28T06:22:17.199Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "148971.05", "edit_enabled_till": null}	3	2026-04-28 06:22:17.199953
57	daily_entries	56	{}	{"id": 56, "cash": "0.00", "date": "2026-04-01T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "5818.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-28T06:26:26.184Z", "total_sale": "5818.00", "approved_at": "2026-04-28T06:26:26.184Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "5818.00", "edit_enabled_till": null}	3	2026-04-28 06:26:26.184437
58	daily_entries	57	{}	{"id": 57, "cash": "0.00", "date": "2026-04-02T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "20336.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-28T06:27:14.418Z", "total_sale": "20336.00", "approved_at": "2026-04-28T06:27:14.418Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "20336.00", "edit_enabled_till": null}	3	2026-04-28 06:27:14.418437
59	daily_entries	58	{}	{"id": 58, "cash": "3000.00", "date": "2026-04-03T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "103014.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-28T06:28:38.217Z", "total_sale": "106014.00", "approved_at": "2026-04-28T06:28:38.217Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "106014.00", "edit_enabled_till": null}	3	2026-04-28 06:28:38.217399
60	daily_entries	59	{}	{"id": 59, "cash": "8236.00", "date": "2026-04-04T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "107269.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-28T06:29:35.542Z", "total_sale": "115505.00", "approved_at": "2026-04-28T06:29:35.542Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "115505.00", "edit_enabled_till": null}	3	2026-04-28 06:29:35.542032
61	daily_entries	60	{}	{"id": 60, "cash": "0.00", "date": "2026-04-28T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "630.00", "shop_id": 2, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-28T15:03:28.233Z", "total_sale": "630.00", "approved_at": "2026-04-28T15:03:28.233Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "630.00", "edit_enabled_till": null}	3	2026-04-28 15:03:28.233544
62	daily_entries	61	{}	{"id": 61, "cash": "0.00", "date": "2026-04-28T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "13040.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-28T16:58:56.308Z", "total_sale": "13040.00", "approved_at": "2026-04-28T16:58:56.308Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "13040.00", "edit_enabled_till": null}	3	2026-04-28 16:58:56.30862
63	daily_entries	62	{}	{"id": 62, "cash": "0.00", "date": "2026-04-29T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "899.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-29T05:58:18.272Z", "total_sale": "899.00", "approved_at": "2026-04-29T05:58:18.272Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "899.00", "edit_enabled_till": null}	3	2026-04-29 05:58:18.272713
64	daily_entries	62	{"id": 62, "cash": "0.00", "date": "2026-04-29T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "899.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-29T05:58:18.272Z", "total_sale": "899.00", "approved_at": "2026-04-29T05:58:18.272Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "899.00", "edit_enabled_till": null}	{"id": 62, "cash": "0.00", "date": "2026-04-27T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "899.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-29T05:58:18.272Z", "total_sale": "899.00", "approved_at": "2026-04-29T05:58:18.272Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "899.00", "edit_enabled_till": null}	3	2026-04-29 05:59:04.275304
65	daily_entries	61	{"id": 61, "cash": "0.00", "date": "2026-04-28T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "13040.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-28T16:58:56.308Z", "total_sale": "13040.00", "approved_at": "2026-04-28T16:58:56.308Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "13040.00", "edit_enabled_till": null}	{"id": 61, "cash": "30.00", "date": "2026-04-28T00:00:00.000Z", "paytm": "0.00", "locked": true, "online": "13010.00", "shop_id": 1, "razorpay": "0.00", "photo_url": null, "created_at": "2026-04-28T16:58:56.308Z", "total_sale": "13040.00", "approved_at": "2026-04-28T16:58:56.308Z", "approved_by": 3, "submitted_lat": null, "submitted_lng": null, "rejection_note": null, "approval_status": "APPROVED", "excel_total_sale": "13040.00", "edit_enabled_till": null}	3	2026-04-29 08:51:10.003865
\.


--
-- Data for Name: cash_flows; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cash_flows (id, shop_id, amount, type, done_by, note, date, created_at) FROM stdin;
1	2	20000.00	expense			2026-04-27	2026-04-27 10:10:49.982353
\.


--
-- Data for Name: cash_transfers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cash_transfers (id, from_user_id, to_user_id, amount, note, status, created_at, updated_at) FROM stdin;
2	13	15	2805.00	NA	accepted	2026-04-27 06:23:07.835346	2026-04-27 06:23:19.444088
3	13	2	20000.00	\N	accepted	2026-04-27 10:07:53.791811	2026-04-27 10:09:34.013844
20	13	15	200.00	nm,	accepted	2026-04-28 18:36:05.455468	2026-04-28 19:47:43.487393
31	13	15	3145.00	20 April 	accepted	2026-04-29 06:23:36.280894	2026-04-29 06:25:53.844562
30	13	15	2570.00	19 April 	accepted	2026-04-29 06:23:01.319966	2026-04-29 06:25:55.226118
29	13	15	110.00	18 April 	accepted	2026-04-29 06:22:42.957594	2026-04-29 06:25:57.155268
28	13	15	1599.00	17 April 	accepted	2026-04-29 06:21:51.516183	2026-04-29 06:25:58.024437
27	13	15	5640.00	16 April 	accepted	2026-04-29 06:21:01.245419	2026-04-29 06:25:58.917647
26	13	15	540.00	15 April 	accepted	2026-04-29 06:20:36.337785	2026-04-29 06:25:59.468797
25	13	15	425.00	14 April 	accepted	2026-04-29 06:20:07.22081	2026-04-29 06:25:59.934997
24	13	15	429.00	13 April 	accepted	2026-04-29 06:17:54.600163	2026-04-29 06:26:00.579642
23	13	15	3090.00	12 April 	accepted	2026-04-29 06:17:33.401745	2026-04-29 06:26:01.183824
22	13	15	30346.00	11 april	accepted	2026-04-29 06:17:17.173418	2026-04-29 06:26:01.815969
21	13	15	5500.00	10 april	accepted	2026-04-29 06:16:59.395049	2026-04-29 06:26:02.397271
\.


--
-- Data for Name: cities; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cities (id, state_id, name, created_at) FROM stdin;
1	1	PUNE	2026-04-19 07:01:35.662159
\.


--
-- Data for Name: daily_entries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.daily_entries (id, shop_id, date, total_sale, cash, online, paytm, razorpay, locked, edit_enabled_till, photo_url, submitted_lat, submitted_lng, created_at, approval_status, excel_total_sale, approved_by, approved_at, rejection_note) FROM stdin;
7	2	2026-04-05	161014.00	2805.00	155109.00	0.00	3100.00	t	\N	\N	\N	\N	2026-04-27 06:09:54.741692	APPROVED	161014.00	1	2026-04-27 06:09:54.741692	\N
58	1	2026-04-03	106014.00	3000.00	103014.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-28 06:28:38.217399	APPROVED	106014.00	3	2026-04-28 06:28:38.217399	\N
3	\N	2026-04-19	39547.00	19000.00	547.00	0.00	20000.00	t	\N	\N	\N	\N	2026-04-19 12:27:30.281992	PENDING	39547.00	\N	\N	\N
4	\N	2026-04-19	39547.00	39000.00	47.00	0.00	500.00	t	\N	\N	\N	\N	2026-04-19 12:28:57.850521	PENDING	39547.00	\N	\N	\N
5	\N	2026-04-19	4787.00	2000.00	787.00	0.00	2000.00	t	\N	\N	\N	\N	2026-04-19 13:05:10.306924	PENDING	4787.00	\N	\N	\N
8	1	2026-04-05	138485.00	7000.00	131485.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 06:38:18.714371	APPROVED	138485.00	3	2026-04-27 06:38:18.714371	\N
9	1	2026-04-06	128817.00	18800.00	110017.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 07:15:32.217272	APPROVED	128817.00	3	2026-04-27 07:15:32.217272	\N
10	1	2026-04-07	143461.25	14400.00	129061.00	0.00	0.25	t	\N	\N	\N	\N	2026-04-27 07:17:24.653486	APPROVED	143461.25	3	2026-04-27 07:17:24.653486	\N
11	1	2026-04-08	56465.00	2970.00	53495.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 07:18:37.444917	APPROVED	56465.00	3	2026-04-27 07:18:37.444917	\N
12	1	2026-04-09	19170.00	600.00	18570.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 07:20:03.15509	APPROVED	19170.00	3	2026-04-27 07:20:03.15509	\N
13	1	2026-04-10	6931.00	0.00	6931.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 07:21:46.410674	APPROVED	6931.00	3	2026-04-27 07:21:46.410674	\N
14	1	2026-04-11	39373.00	4800.00	34573.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 07:23:42.111713	APPROVED	39373.00	3	2026-04-27 07:23:42.111713	\N
15	1	2026-04-12	58476.00	9479.00	48997.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 07:27:36.750847	APPROVED	58476.00	3	2026-04-27 07:27:36.750847	\N
16	1	2026-04-13	33353.00	170.00	33183.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 07:28:44.243879	APPROVED	33353.00	3	2026-04-27 07:28:44.243879	\N
17	1	2026-04-14	21899.00	0.00	21899.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 07:30:59.056188	APPROVED	21899.00	3	2026-04-27 07:30:59.056188	\N
18	1	2026-04-15	860.00	0.00	860.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 07:32:40.072203	APPROVED	860.00	3	2026-04-27 07:32:40.072203	\N
19	1	2026-04-16	15890.00	4926.00	10964.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 07:33:50.408107	APPROVED	15890.00	3	2026-04-27 07:33:50.408107	\N
20	1	2026-04-17	2336.00	0.00	2336.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 07:34:50.722017	APPROVED	2336.00	3	2026-04-27 07:34:50.722017	\N
21	1	2026-04-18	32947.00	0.00	32947.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 07:35:36.286948	APPROVED	32947.00	3	2026-04-27 07:35:36.286948	\N
22	1	2026-04-19	30314.00	0.00	30314.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 07:37:20.93846	APPROVED	30314.00	3	2026-04-27 07:37:20.93846	\N
23	1	2026-04-20	15068.00	0.00	15068.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 07:38:19.329914	APPROVED	15068.00	3	2026-04-27 07:38:19.329914	\N
24	1	2026-04-21	10669.00	440.00	10229.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 07:39:16.66609	APPROVED	10669.00	3	2026-04-27 07:39:16.66609	\N
25	1	2026-04-22	1770.00	100.00	1670.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 07:40:21.130348	APPROVED	1770.00	3	2026-04-27 07:40:21.130348	\N
26	1	2026-04-23	3840.00	160.00	3680.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 07:43:45.5816	APPROVED	3840.00	3	2026-04-27 07:43:45.5816	\N
27	1	2026-04-24	10.00	10.00	0.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 07:44:31.193973	APPROVED	10.00	3	2026-04-27 07:44:31.193973	\N
28	1	2026-04-25	9540.00	0.00	9540.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 07:45:43.470539	APPROVED	9540.00	3	2026-04-27 07:45:43.470539	\N
29	1	2026-04-26	9408.00	700.00	8708.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 07:47:44.057905	APPROVED	9408.00	3	2026-04-27 07:47:44.057905	\N
30	2	2026-04-06	146467.00	15020.00	106603.00	0.00	24844.00	t	\N	\N	\N	\N	2026-04-27 07:54:53.593442	APPROVED	146467.00	3	2026-04-27 07:54:53.593442	\N
31	2	2026-04-07	283644.00	0.00	249784.00	0.00	33860.00	t	\N	\N	\N	\N	2026-04-27 07:57:38.630542	APPROVED	283644.00	3	2026-04-27 07:57:38.630542	\N
33	2	2026-04-09	63239.00	2065.00	58157.00	0.00	3017.00	t	\N	\N	\N	\N	2026-04-27 08:02:18.015805	APPROVED	63239.00	3	2026-04-27 08:02:18.015805	\N
34	2	2026-04-10	29371.00	5500.00	23865.00	0.00	6.00	t	\N	\N	\N	\N	2026-04-27 08:03:47.691984	APPROVED	29371.00	3	2026-04-27 08:03:47.691984	\N
35	2	2026-04-11	120378.00	30346.00	90032.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 08:05:26.494406	APPROVED	120378.00	3	2026-04-27 08:05:26.494406	\N
36	2	2026-04-12	79469.00	3090.00	76379.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 08:06:49.306416	APPROVED	79469.00	3	2026-04-27 08:06:49.306416	\N
37	2	2026-04-13	6941.00	429.00	6512.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 08:08:16.933988	APPROVED	6941.00	3	2026-04-27 08:08:16.933988	\N
38	2	2026-04-14	33732.00	425.00	33307.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 08:09:15.558087	APPROVED	33732.00	3	2026-04-27 08:09:15.558087	\N
39	2	2026-04-15	10919.00	540.00	7850.00	0.00	2529.00	t	\N	\N	\N	\N	2026-04-27 08:10:41.158823	APPROVED	10919.00	3	2026-04-27 08:10:41.158823	\N
40	2	2026-04-16	40955.00	5640.00	35315.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 08:11:45.306078	APPROVED	40955.00	3	2026-04-27 08:11:45.306078	\N
41	2	2026-04-17	1629.00	1599.00	30.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 08:12:53.259608	APPROVED	1629.00	3	2026-04-27 08:12:53.259608	\N
44	2	2026-04-20	37422.00	3145.00	34277.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 09:43:05.90419	APPROVED	37422.00	3	2026-04-27 09:43:05.90419	\N
45	2	2026-04-21	59336.80	0.00	59336.80	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 09:44:17.877296	APPROVED	59336.80	3	2026-04-27 09:44:17.877296	\N
46	2	2026-04-22	9809.00	0.00	9809.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 09:45:17.121945	APPROVED	9809.00	3	2026-04-27 09:45:17.121945	\N
47	2	2026-04-23	4141.00	0.00	4141.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 09:46:03.805723	APPROVED	4141.00	3	2026-04-27 09:46:03.805723	\N
48	2	2026-04-24	9425.00	0.00	9425.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 09:47:10.45744	APPROVED	9425.00	3	2026-04-27 09:47:10.45744	\N
49	2	2026-04-25	6650.00	0.00	6650.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 09:47:55.7171	APPROVED	6650.00	3	2026-04-27 09:47:55.7171	\N
50	2	2026-04-26	26490.00	0.00	26490.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 09:49:07.008617	APPROVED	26490.00	3	2026-04-27 09:49:07.008617	\N
59	1	2026-04-04	115505.00	8236.00	107269.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-28 06:29:35.542032	APPROVED	115505.00	3	2026-04-28 06:29:35.542032	\N
43	2	2026-04-19	50605.00	2570.00	48035.00	0.00	0.00	t	2026-04-27 12:20:24.806	\N	\N	\N	2026-04-27 09:40:20.81366	APPROVED	50605.00	3	2026-04-27 09:40:20.81366	\N
60	2	2026-04-28	630.00	0.00	630.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-28 15:03:28.233544	APPROVED	630.00	3	2026-04-28 15:03:28.233544	\N
42	2	2026-04-18	27597.00	5600.00	21997.00	0.00	0.00	t	2026-04-27 12:22:38.099	\N	\N	\N	2026-04-27 08:14:28.487165	APPROVED	27597.00	3	2026-04-27 08:14:28.487165	\N
51	2	2026-04-27	1020.00	0.00	1020.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-27 14:24:23.659227	APPROVED	1020.00	3	2026-04-27 17:07:26.846638	\N
32	2	2026-04-08	55551.00	5335.00	49470.00	0.00	746.00	t	2026-04-27 18:27:16.524	\N	\N	\N	2026-04-27 08:00:51.676014	APPROVED	55551.00	3	2026-04-27 08:00:51.676014	\N
52	2	2026-04-01	25266.00	0.00	25266.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-28 06:18:21.277627	APPROVED	25266.00	3	2026-04-28 06:18:21.277627	\N
53	2	2026-04-02	39699.00	0.00	39699.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-28 06:18:59.896702	APPROVED	39699.00	3	2026-04-28 06:18:59.896702	\N
54	2	2026-04-03	38253.00	0.00	38253.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-28 06:19:35.836887	APPROVED	38253.00	3	2026-04-28 06:19:35.836887	\N
55	2	2026-04-04	148971.05	0.00	148971.05	0.00	0.00	t	\N	\N	\N	\N	2026-04-28 06:22:17.199953	APPROVED	148971.05	3	2026-04-28 06:22:17.199953	\N
56	1	2026-04-01	5818.00	0.00	5818.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-28 06:26:26.184437	APPROVED	5818.00	3	2026-04-28 06:26:26.184437	\N
57	1	2026-04-02	20336.00	0.00	20336.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-28 06:27:14.418437	APPROVED	20336.00	3	2026-04-28 06:27:14.418437	\N
62	1	2026-04-27	899.00	0.00	899.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-29 05:58:18.272713	APPROVED	899.00	3	2026-04-29 05:58:18.272713	\N
61	1	2026-04-28	13040.00	30.00	13010.00	0.00	0.00	t	\N	\N	\N	\N	2026-04-28 16:58:56.30862	APPROVED	13040.00	3	2026-04-28 16:58:56.30862	\N
\.


--
-- Data for Name: excel_uploads; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.excel_uploads (id, user_id, shop_id, filename, upload_date, total_sale, row_data, created_at) FROM stdin;
1	1	\N	Day_Book_Report_18-04-2026.xls	2026-04-18	9574.00	[{"Name": "9850928505", "Paid Amount": "0.0", "Payment Type": "CARD / PAYTM", "Total Amount": "2555.00", "Balance Amount": "₹ 0.00", "Received Amount": "₹ 2555.00", "Transaction Type": "Sale"}, {"Name": "9873030012", "Paid Amount": "₹ 0.00", "Payment Type": "CREDIT NOTE", "Total Amount": "578.00", "Balance Amount": "₹ 578.00", "Received Amount": "0.0", "Transaction Type": "Credit Note"}, {"Name": "9873030012", "Paid Amount": "0.0", "Payment Type": "CARD / PAYTM", "Total Amount": "2810.00", "Balance Amount": "₹ 578.00", "Received Amount": "₹ 2232.00", "Transaction Type": "Sale"}, {"Name": "9028094422", "Paid Amount": "0.0", "Payment Type": "CREDIT NOTE", "Total Amount": "1049.00", "Balance Amount": "₹ 1049.00", "Received Amount": "₹ 0.00", "Transaction Type": "Sale"}, {"Name": "", "Paid Amount": "0.00", "Payment Type": "", "Total Amount": "Total", "Balance Amount": null, "Received Amount": "4787.00", "Transaction Type": ""}, {"Name": "Money In - Money Out", "Paid Amount": "", "Payment Type": "", "Total Amount": "", "Balance Amount": "₹ 4787.00", "Received Amount": "", "Transaction Type": ""}]	2026-04-19 06:35:01.054894+00
\.


--
-- Data for Name: manager_transfers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.manager_transfers (id, manager_id, to_admin_id, amount, type, note, receipt_url, status, approved_by, approved_at, rejection_note, created_at) FROM stdin;
1	15	3	75799.00	manager_to_admin	Updated on  splitwise 	\N	approved	3	2026-04-29 06:24:27.709576	\N	2026-04-29 06:22:41.617454
4	15	\N	998.97	manager_to_bank	LLLLLLLL	/uploads/receipt-1777444426571-499553632.jpeg	pending	\N	\N	\N	2026-04-29 06:33:46.581065
2	15	3	50000.00	manager_to_admin	 UPDATED ON SPLITWISE 53394(394 BANK TRANSFER )	\N	approved	3	2026-04-29 06:34:03.957723	\N	2026-04-29 06:30:42.868979
3	15	\N	3394.00	manager_to_bank	IIIIIIIIIII	/uploads/receipt-1777444382481-510572599.jpeg	approved	3	2026-04-29 06:34:07.487533	\N	2026-04-29 06:33:02.495724
5	2	3	20000.00	manager_to_admin	 HANDOVER TO SAHEB SIR 	\N	approved	3	2026-04-29 06:53:27.939985	\N	2026-04-29 06:53:24.592211
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, user_id, type, message, is_read, created_at) FROM stdin;
\.


--
-- Data for Name: shops; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shops (id, state_id, city_id, shop_name, gst_number, shop_address, manager_name, mobile_number, document_type, document_number, user_id, latitude, longitude, created_at) FROM stdin;
3	1	1	Amonora Apex 	27AA48PCD	Amonora apex pune mahrashtra 	Mithlesh	852963741	aadhaar	425316080871	12	\N	\N	2026-04-27 05:54:42.427796
2	1	1	Kalyani Nagar 	Wrlpoi78998	Kalyani Nagar 	Mithilesh	8421066379	aadhaar	135678900	13	\N	\N	2026-04-21 11:52:25.111704
1	1	1	WAGHOLI	27AA4AJKAJLS	34/31 fourth floor west patel nagar near anand nursing home pin 110008	SHOYAV	09131903024	aadhaar	7418525274152	17	\N	\N	2026-04-19 07:02:23.686331
\.


--
-- Data for Name: states; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.states (id, name, created_at) FROM stdin;
1	MAHARASHTRA	2026-04-19 07:01:20.169459
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.users (id, mobile, password_hash, role, name, is_approved, created_at, wallet_balance, deleted_at) FROM stdin;
1	8817654579	$2b$10$LD7jHGzun0kiajB/sUfivevxbHqzjMaObxCS0AUya2NpIxO5vTgd2	admin	Harsh	t	2026-04-19 06:31:29.280516	0.00	\N
11	8928444404	$2b$10$49vB/Q.h10l6co4uniLm0eGmmK/OFstWX.MF57D3LoVkcQcJzfIf6	admin	 Manpreet 	t	2026-04-27 05:40:40.840001	0.00	\N
12	7982193939	$2b$10$9lIzo/WXaNBKLlGoO3wj4.6biF1dYPElrMHa5zfsyBMREK6Hz/ZRO	shop_user	Vivek singh 	t	2026-04-27 05:52:24.5957	0.00	\N
13	8668504084	$2b$10$vDxP9l0VgEOPF3g.HJMDie99HUpICVdBECs/XTP/1YUvyG3oH7Ati	shop_user	Neelam 	t	2026-04-27 06:01:01.321706	7710.00	\N
15	8421066379	$2b$10$4hrggb6oZ8wUC101wCVGouR7UfaplrhVzuQ02x0SQNn9AOVFxBOTO	manager	Mithilesh	t	2026-04-27 06:15:20.994083	0.00	\N
2	8983618757	$2b$10$Q41Pa8eZOhFZV7e9mC8CluPBtGY001aQihD/ixiOtkf.N9UMZ73Em	manager	Shoyeb	t	2026-04-19 06:57:44.565567	0.00	\N
3	9371222202	$2b$10$SLAgisVgUDwsAtER1o9MPew6E6PwUIE0UXn9ttFHDp6Nnr3rHTQge	admin	Ssahebh 	t	2026-04-19 11:09:10.434049	145799.00	\N
17	8459876182	$2b$10$R5jYrbJCepwEd7KXmsbUaerDQDcDTFUzJbu.dDsoCqqN21/mG5StK	shop_user	Dipti Gawade	t	2026-04-28 14:46:55.395968	30.00	\N
16	8983315176	$2b$10$mke/r9P9LHbIHdOBEqVDIO417v7PI8uS5Xsmy0Lq41Jbpvj522Ieq	shop_user	Nikita mahesh salve	t	2026-04-27 09:55:50.854971	0.00	\N
\.


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 65, true);


--
-- Name: cash_flows_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cash_flows_id_seq', 1, true);


--
-- Name: cash_transfers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cash_transfers_id_seq', 31, true);


--
-- Name: cities_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cities_id_seq', 1, true);


--
-- Name: daily_entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.daily_entries_id_seq', 62, true);


--
-- Name: excel_uploads_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.excel_uploads_id_seq', 1, true);


--
-- Name: manager_transfers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.manager_transfers_id_seq', 5, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notifications_id_seq', 1, false);


--
-- Name: shops_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.shops_id_seq', 3, true);


--
-- Name: states_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.states_id_seq', 1, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.users_id_seq', 20, true);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: cash_flows cash_flows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_flows
    ADD CONSTRAINT cash_flows_pkey PRIMARY KEY (id);


--
-- Name: cash_transfers cash_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_transfers
    ADD CONSTRAINT cash_transfers_pkey PRIMARY KEY (id);


--
-- Name: cities cities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_pkey PRIMARY KEY (id);


--
-- Name: cities cities_state_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_state_id_name_key UNIQUE (state_id, name);


--
-- Name: daily_entries daily_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_entries
    ADD CONSTRAINT daily_entries_pkey PRIMARY KEY (id);


--
-- Name: daily_entries daily_entries_shop_id_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_entries
    ADD CONSTRAINT daily_entries_shop_id_date_key UNIQUE (shop_id, date);


--
-- Name: excel_uploads excel_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.excel_uploads
    ADD CONSTRAINT excel_uploads_pkey PRIMARY KEY (id);


--
-- Name: manager_transfers manager_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.manager_transfers
    ADD CONSTRAINT manager_transfers_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: shops shops_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_pkey PRIMARY KEY (id);


--
-- Name: states states_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.states
    ADD CONSTRAINT states_name_key UNIQUE (name);


--
-- Name: states states_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.states
    ADD CONSTRAINT states_pkey PRIMARY KEY (id);


--
-- Name: users users_mobile_key; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_mobile_key UNIQUE (mobile);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_cash_flows_shop_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cash_flows_shop_date ON public.cash_flows USING btree (shop_id, date);


--
-- Name: idx_cash_transfers_from; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cash_transfers_from ON public.cash_transfers USING btree (from_user_id);


--
-- Name: idx_cash_transfers_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cash_transfers_status ON public.cash_transfers USING btree (status);


--
-- Name: idx_cash_transfers_to; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cash_transfers_to ON public.cash_transfers USING btree (to_user_id);


--
-- Name: idx_daily_entries_approval; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_entries_approval ON public.daily_entries USING btree (approval_status);


--
-- Name: idx_daily_entries_shop_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_entries_shop_date ON public.daily_entries USING btree (shop_id, date);


--
-- Name: idx_excel_uploads_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_excel_uploads_date ON public.excel_uploads USING btree (upload_date DESC);


--
-- Name: idx_excel_uploads_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_excel_uploads_user ON public.excel_uploads USING btree (user_id);


--
-- Name: idx_manager_transfers_manager; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_manager_transfers_manager ON public.manager_transfers USING btree (manager_id);


--
-- Name: idx_manager_transfers_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_manager_transfers_status ON public.manager_transfers USING btree (status);


--
-- Name: idx_manager_transfers_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_manager_transfers_type ON public.manager_transfers USING btree (type);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, is_read);


--
-- Name: idx_shops_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shops_user_id ON public.shops USING btree (user_id);


--
-- Name: audit_logs audit_logs_edited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_edited_by_fkey FOREIGN KEY (edited_by) REFERENCES public.users(id);


--
-- Name: cash_flows cash_flows_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_flows
    ADD CONSTRAINT cash_flows_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: cash_transfers cash_transfers_from_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_transfers
    ADD CONSTRAINT cash_transfers_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: cash_transfers cash_transfers_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_transfers
    ADD CONSTRAINT cash_transfers_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: cities cities_state_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.states(id) ON DELETE CASCADE;


--
-- Name: daily_entries daily_entries_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_entries
    ADD CONSTRAINT daily_entries_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: daily_entries daily_entries_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_entries
    ADD CONSTRAINT daily_entries_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: excel_uploads excel_uploads_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.excel_uploads
    ADD CONSTRAINT excel_uploads_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE SET NULL;


--
-- Name: excel_uploads excel_uploads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.excel_uploads
    ADD CONSTRAINT excel_uploads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: manager_transfers manager_transfers_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.manager_transfers
    ADD CONSTRAINT manager_transfers_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: manager_transfers manager_transfers_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.manager_transfers
    ADD CONSTRAINT manager_transfers_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: manager_transfers manager_transfers_to_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.manager_transfers
    ADD CONSTRAINT manager_transfers_to_admin_id_fkey FOREIGN KEY (to_admin_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: shops shops_city_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities(id);


--
-- Name: shops shops_state_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.states(id);


--
-- Name: shops shops_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.audit_logs TO admin;


--
-- Name: SEQUENCE audit_logs_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.audit_logs_id_seq TO admin;


--
-- Name: TABLE cash_flows; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cash_flows TO admin;


--
-- Name: SEQUENCE cash_flows_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.cash_flows_id_seq TO admin;


--
-- Name: TABLE cash_transfers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cash_transfers TO admin;


--
-- Name: SEQUENCE cash_transfers_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.cash_transfers_id_seq TO admin;


--
-- Name: TABLE cities; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cities TO admin;


--
-- Name: SEQUENCE cities_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.cities_id_seq TO admin;


--
-- Name: TABLE daily_entries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.daily_entries TO admin;


--
-- Name: SEQUENCE daily_entries_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.daily_entries_id_seq TO admin;


--
-- Name: TABLE excel_uploads; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.excel_uploads TO admin;


--
-- Name: SEQUENCE excel_uploads_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.excel_uploads_id_seq TO admin;


--
-- Name: TABLE manager_transfers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.manager_transfers TO admin;


--
-- Name: SEQUENCE manager_transfers_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.manager_transfers_id_seq TO admin;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notifications TO admin;


--
-- Name: SEQUENCE notifications_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.notifications_id_seq TO admin;


--
-- Name: TABLE shops; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.shops TO admin;


--
-- Name: SEQUENCE shops_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.shops_id_seq TO admin;


--
-- Name: TABLE states; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.states TO admin;


--
-- Name: SEQUENCE states_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.states_id_seq TO admin;


--
-- PostgreSQL database dump complete
--

\unrestrict hMjsOszBCB2VqXfqoLDP4yuh6USmJ8DpofxN7Dlw7xIN0KsXs7LoOXJiolNceMP


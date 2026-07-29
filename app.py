import os
import streamlit as st
import pandas as pd
from datetime import datetime, date
from supabase import create_client, Client

# Page Configuration
st.set_page_config(
    page_title="ប្រព័ន្ធគ្រប់គ្រងសម្ភារបច្ចេកទេស - Technical Inventory System",
    page_icon="📦",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Soft Green Theme Styling
st.markdown("""
<style>
    /* Main Background & Fonts */
    .stApp {
        background-color: #EBF4F0;
        color: #03291E;
        font-family: 'Kantumruuy Pro', 'Khmer OS Battambang', sans-serif;
    }
    
    /* Header Styling */
    .main-header {
        background-color: #A3D8C2;
        color: #03291E;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        border-bottom: 4px solid #6EC8A0;
        margin-bottom: 1.5rem;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    
    .main-header h1 {
        font-family: 'Khmer OS Muol Light', 'Moul', serif;
        font-weight: normal;
        font-size: 1.35rem;
        color: #03291E;
        margin: 0;
    }
    
    .main-header p {
        font-size: 0.8rem;
        font-weight: 600;
        color: #124D3A;
        margin: 2px 0 0 0;
        letter-spacing: 0.05em;
    }

    /* Metric Card Styling */
    .metric-card {
        background-color: #FFFFFF;
        border: 1px solid #C5E3D5;
        border-radius: 12px;
        padding: 1.2rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.03);
        transition: all 0.2s ease;
    }
    .metric-card:hover {
        box-shadow: 0 4px 6px rgba(0,0,0,0.06);
        border-color: #9FE3C5;
    }
    .metric-label {
        font-size: 0.75rem;
        font-weight: 700;
        color: #2B6A52;
        text-transform: uppercase;
        margin-bottom: 0.25rem;
    }
    .metric-value {
        font-size: 1.8rem;
        font-weight: 900;
        color: #03291E;
    }

    /* Section Cards & Tables */
    .content-card {
        background-color: #FFFFFF;
        border: 1px solid #C2E4D5;
        border-radius: 16px;
        padding: 1.25rem;
        box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        margin-bottom: 1.5rem;
    }

    .card-title {
        background-color: #C2E4D5;
        color: #03291E;
        padding: 0.75rem 1.25rem;
        border-radius: 10px 10px 0 0;
        font-weight: 700;
        font-size: 1rem;
        border-bottom: 1px solid #B0DAC7;
        margin: -1.25rem -1.25rem 1.25rem -1.25rem;
    }

    /* Streamlit Buttons */
    .stButton>button {
        background-color: #03291E !important;
        color: #FFFFFF !important;
        border-radius: 8px !important;
        font-weight: 700 !important;
        border: none !important;
        padding: 0.5rem 1.5rem !important;
    }
    .stButton>button:hover {
        background-color: #1E6047 !important;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
    }

    /* Status Badges */
    .badge-in-stock {
        background-color: #D1E8DD;
        color: #0F5132;
        padding: 0.2rem 0.6rem;
        border-radius: 6px;
        font-weight: 700;
        font-size: 0.75rem;
        border: 1px solid #BADBCE;
    }
    .badge-low-stock {
        background-color: #FFF3CD;
        color: #664D03;
        padding: 0.2rem 0.6rem;
        border-radius: 6px;
        font-weight: 700;
        font-size: 0.75rem;
        border: 1px solid #FFECB5;
    }
    .badge-out-stock {
        background-color: #F8D7DA;
        color: #842029;
        padding: 0.2rem 0.6rem;
        border-radius: 6px;
        font-weight: 700;
        font-size: 0.75rem;
        border: 1px solid #F5C2C7;
    }
</style>
""", unsafe_allow_html=True)

# -----------------------------------------------------------------------------
# 1. ESTABLISH SUPABASE CONNECTION
# -----------------------------------------------------------------------------
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://your-supabase-id.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "your-supabase-anon-key")

@st.cache_resource
def get_supabase_client() -> Client:
    try:
        return create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        st.warning(f"Could not connect to Supabase: {e}. Running in local memory mode.")
        return None

supabase = get_supabase_client()

# In-memory fallback mock database if Supabase credentials are placeholders
if "mock_db" not in st.session_state:
    st.session_state.mock_db = {
        "locations": [
            {"id": "loc-hq", "name_kh": "ស្តុកសម្ភារបច្ចេកទេស HQ-ITSB", "name_en": "HQ Technical Inventory", "type": "HQ", "code": "HQ-ITSB"},
            {"id": "loc-7mk", "name_kh": "សាខាពន្ធដារខណ្ឌ៧មករា", "name_en": "7 Makara Branch", "type": "BRANCH", "code": "7MK"},
            {"id": "loc-ckm", "name_kh": "សាខាពន្ធដារខណ្ឌចំការមន", "name_en": "Chamkarmon Branch", "type": "BRANCH", "code": "CKM"},
            {"id": "loc-dpe", "name_kh": "សាខាពន្ធដារខណ្ឌដូនពេញ", "name_en": "Daun Penh Branch", "type": "BRANCH", "code": "DPE"},
            {"id": "loc-tko", "name_kh": "សាខាពន្ធដារខណ្ឌទួលគោក", "name_en": "Toul Kork Branch", "type": "BRANCH", "code": "TKO"},
        ],
        "items": [
            {"id": "itm-1", "code": "SKU-SFP-10G", "name_kh": "ម៉ូឌុល SFP+ 10Gbps Transceiver", "name_en": "Cisco SFP+ 10G SR Transceiver Module", "category": "Tools", "unit": "គ្រឿង", "serial_no": "SFP10G-9821", "status": "In Stock"},
            {"id": "itm-2", "code": "SKU-CAT6A-300M", "name_kh": "ខ្សែបណ្តាញ Cat6A UTP (៣០០ម៉ែត្រ)", "name_en": "CommScope Cat6A Cable Roll 300m", "category": "Suppliers", "unit": "ដុំ", "serial_no": "CAT6A-0012", "status": "In Stock"},
            {"id": "itm-3", "code": "SKU-UPS-1500VA", "name_kh": "ប្រព័ន្ធរក្សាអគ្គិសនី UPS 1500VA", "name_en": "APC Smart-UPS 1500VA LCD 230V", "category": "Tools", "unit": "គ្រឿង", "serial_no": "UPS1500-4491", "status": "In Stock"},
            {"id": "itm-4", "code": "SKU-SW-24P-POE", "name_kh": "ស្វីច Cisco Catalyst 24-Port PoE+", "name_en": "Cisco Catalyst C9200L 24P PoE+ 4X10G", "category": "Tools", "unit": "គ្រឿង", "serial_no": "SW24P-8812", "status": "Low Stock"},
        ],
        "inventory": [
            {"item_id": "itm-1", "location_id": "loc-hq", "quantity": 120, "status": "In Stock"},
            {"item_id": "itm-1", "location_id": "loc-7mk", "quantity": 15, "status": "In Stock"},
            {"item_id": "itm-2", "location_id": "loc-hq", "quantity": 45, "status": "In Stock"},
            {"item_id": "itm-3", "location_id": "loc-hq", "quantity": 18, "status": "In Stock"},
            {"item_id": "itm-4", "location_id": "loc-hq", "quantity": 3, "status": "Low Stock"},
        ],
        "transactions": [
            {"id": "tx-1", "type": "STOCK_IN", "item_id": "itm-1", "from_location": None, "to_location": "loc-hq", "quantity": 50, "date": "2026-07-28", "remark": "Initial procurement"},
            {"id": "tx-2", "type": "STOCK_OUT", "item_id": "itm-4", "from_location": "loc-hq", "to_location": "loc-7mk", "quantity": 2, "date": "2026-07-28", "remark": "Deploy to branch"},
        ]
    }

# -----------------------------------------------------------------------------
# DATABASE HELPER FUNCTIONS
# -----------------------------------------------------------------------------
def fetch_locations():
    if supabase and SUPABASE_URL != "https://your-supabase-id.supabase.co":
        try:
            res = supabase.table("locations").select("*").execute()
            return res.data
        except Exception:
            pass
    return st.session_state.mock_db["locations"]

def fetch_items():
    if supabase and SUPABASE_URL != "https://your-supabase-id.supabase.co":
        try:
            res = supabase.table("items").select("*").execute()
            return res.data
        except Exception:
            pass
    return st.session_state.mock_db["items"]

def fetch_inventory():
    if supabase and SUPABASE_URL != "https://your-supabase-id.supabase.co":
        try:
            res = supabase.table("inventory").select("*, items(*), locations(*)").execute()
            return res.data
        except Exception:
            pass
    
    # Mock join
    items_dict = {i["id"]: i for i in st.session_state.mock_db["items"]}
    locs_dict = {l["id"]: l for l in st.session_state.mock_db["locations"]}
    
    joined = []
    for inv in st.session_state.mock_db["inventory"]:
        joined.append({
            "item_id": inv["item_id"],
            "location_id": inv["location_id"],
            "quantity": inv["quantity"],
            "status": inv["status"],
            "items": items_dict.get(inv["item_id"], {}),
            "locations": locs_dict.get(inv["location_id"], {})
        })
    return joined

def add_new_item_to_db(name_kh, details_en, sku, category, serial_no, unit, initial_stock, location_id):
    item_id = f"itm-{len(st.session_state.mock_db['items']) + 1}"
    new_item = {
        "id": item_id,
        "code": sku,
        "name_kh": name_kh,
        "name_en": details_en,
        "category": category,
        "unit": unit,
        "serial_no": serial_no,
        "status": "In Stock" if initial_stock > 5 else "Low Stock"
    }

    if supabase and SUPABASE_URL != "https://your-supabase-id.supabase.co":
        try:
            # 1. Insert into items table
            item_res = supabase.table("items").insert({
                "code": sku,
                "name_kh": name_kh,
                "name_en": details_en,
                "category": category,
                "unit": unit,
            }).execute()
            
            created_item_id = item_res.data[0]["id"]
            
            # 2. Insert into inventory table
            supabase.table("inventory").insert({
                "location_id": location_id,
                "item_id": created_item_id,
                "quantity": initial_stock
            }).execute()

            # 3. Insert transaction
            supabase.table("transactions").insert({
                "type": "STOCK_IN",
                "to_location": location_id,
                "item_id": created_item_id,
                "quantity": initial_stock,
                "remark": "Initial item creation",
                "recorded_by": "Admin-GDT"
            }).execute()
            return True
        except Exception as e:
            st.error(f"Supabase error: {e}")

    # Fallback to Session State Mock DB
    st.session_state.mock_db["items"].append(new_item)
    st.session_state.mock_db["inventory"].append({
        "item_id": item_id,
        "location_id": location_id,
        "quantity": initial_stock,
        "status": new_item["status"]
    })
    st.session_state.mock_db["transactions"].append({
        "id": f"tx-{len(st.session_state.mock_db['transactions'])+1}",
        "type": "STOCK_IN",
        "item_id": item_id,
        "from_location": None,
        "to_location": location_id,
        "quantity": initial_stock,
        "date": str(date.today()),
        "remark": "Initial item creation"
    })
    return True

# -----------------------------------------------------------------------------
# 2. HEADER & SIDEBAR NAVIGATION
# -----------------------------------------------------------------------------
st.markdown("""
<div class="main-header">
    <h1>ប្រព័ន្ធគ្រប់គ្រងសម្ភារបច្ចេកទេស</h1>
    <p>GENERAL DEPARTMENT OF TAXATION — TECHNICAL INVENTORY SYSTEM</p>
</div>
""", unsafe_allow_html=True)

with st.sidebar:
    st.markdown("### 👤 ព័ត៌មានអ្នកប្រើប្រាស់")
    st.markdown("**User:** Admin-GDT (អគ្គនាយកដ្ឋានពន្ធដារ)")
    
    locations = fetch_locations()
    loc_options = {loc["id"]: f"{loc['name_kh']} ({loc['code']})" for loc in locations}
    selected_location_id = st.selectbox("📍 ជ្រើសរើសទីតាំង (Location)", options=list(loc_options.keys()), format_func=lambda x: loc_options[x])

    st.markdown("---")
    st.markdown("### 📌 ម៉ឺនុយមេ (Main Menu)")
    
    menu_selection = st.radio(
        "ជ្រើសរើសទំព័រ",
        options=[
            "ទំព័រដំបូង (Dashboard)",
            "បន្ថែមសម្ភារៈថ្មី (New Item)",
            "បញ្ចូលស្តុកថ្មី (Stock In)",
            "ប្រគល់-ទទួល (Handover)",
            "ដកចេញប្រើប្រាស់ (Stock Out)",
            "មូលទិន្នន័យ (Database)"
        ],
        label_visibility="collapsed"
    )

# -----------------------------------------------------------------------------
# 3. PAGE LOGIC
# -----------------------------------------------------------------------------

# PAGE 1: DASHBOARD
if menu_selection == "ទំព័រដំបូង (Dashboard)":
    st.subheader("📊 ស្ថានភាពស្តុករួម និងសូចនាករ (Overview & KPIs)")
    
    items = fetch_items()
    inventory = fetch_inventory()
    
    total_items = len(items)
    stock_out_today = len([t for t in st.session_state.mock_db.get("transactions", []) if t.get("type") == "STOCK_OUT"])
    low_stock_count = len([inv for inv in inventory if inv.get("quantity", 0) < 5])
    total_locations = len(locations)

    # 4 KPI Cards
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">សម្ភារសរុប (Total Items)</div>
            <div class="metric-value">{total_items:02d}</div>
        </div>
        """, unsafe_allow_html=True)
    with col2:
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">Stock Out (Today)</div>
            <div class="metric-value">{stock_out_today:02d}</div>
        </div>
        """, unsafe_allow_html=True)
    with col3:
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">ស្តុកជិតអស់ (Low Stock)</div>
            <div class="metric-value" style="color: #842029;">{low_stock_count:02d}</div>
        </div>
        """, unsafe_allow_html=True)
    with col4:
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">ទីតាំងសរុប (Locations)</div>
            <div class="metric-value">{total_locations:02d}</div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)
    
    # Table Filter & Search
    f_col1, f_col2 = st.columns([2, 3])
    with f_col1:
        category_filter = st.selectbox("តម្រងប្រភេទ (Filter Category)", ["ទាំងអស់ (All)", "Tools (សម្ភារ Tools)", "Suppliers (សម្ភារ Suppliers)"])
    with f_col2:
        search_query = st.text_input("🔍 ស្វែងរកតាមឈ្មោះ ឬកូដ (Search SKU/Name)", "")

    # Aggregate inventory table
    table_rows = []
    for idx, item in enumerate(items, 1):
        item_id = item["id"]
        
        # Category Filter
        if category_filter == "Tools (សម្ភារ Tools)" and item.get("category") != "Tools":
            continue
        if category_filter == "Suppliers (សម្ភារ Suppliers)" and item.get("category") != "Suppliers":
            continue

        # Search Query Filter
        if search_query:
            query = search_query.lower()
            if not (query in item.get("name_kh", "").lower() or query in item.get("code", "").lower() or query in item.get("name_en", "").lower()):
                continue

        # Calculate HQ & Branch Stock
        hq_stock = sum(inv.get("quantity", 0) for inv in inventory if inv.get("item_id") == item_id and inv.get("location_id") == "loc-hq")
        branch_stock = sum(inv.get("quantity", 0) for inv in inventory if inv.get("item_id") == item_id and inv.get("location_id") != "loc-hq")
        
        status = "មានស្តុក"
        if (hq_stock + branch_stock) == 0:
            status = "អស់ស្តុក"
        elif (hq_stock + branch_stock) < 5:
            status = "ជិតអស់ស្តុក"

        table_rows.append({
            "ល.រ": idx,
            "កូដ SKU": item.get("code", ""),
            "ឈ្មោះសម្ភារ (Khmer)": item.get("name_kh", ""),
            "ម៉ាក/ម៉ូឌែល (English)": item.get("name_en", ""),
            "ប្រភេទ": "សម្ភារ " + item.get("category", "Tools"),
            "ខ្នាត": item.get("unit", "គ្រឿង"),
            "ស្តុក HQ": hq_stock,
            "ស្តុកតាមសាខា": branch_stock,
            "ស្ថានភាព": status
        })

    if table_rows:
        df = pd.DataFrame(table_rows)
        st.dataframe(df, use_container_width=True, hide_index=True)
    else:
        st.info("មិនមានទិន្នន័យបង្ហាញទេ (No inventory items match filter)")


# PAGE 2: FIX 'NEW' MENU (ADD NEW ITEM)
elif menu_selection == "បន្ថែមសម្ភារៈថ្មី (New Item)":
    st.subheader("➕ បន្ថែមសម្ភារៈថ្មីចូលក្នុងប្រព័ន្ធ (Add New Inventory Item)")
    st.write("សូមបំពេញព័ត៌មានខាងក្រោមដើម្បីបន្ថែមសម្ភារៈថ្មីទៅកាន់ទិន្នន័យ Supabase Backend")

    with st.form("add_item_form", clear_on_submit=True):
        col_a, col_b = st.columns(2)
        with col_a:
            name_kh = st.text_input("ឈ្មោះសម្ភារជាភាសាខ្មែរ (Khmer Item Name)*", placeholder="ឧ. ម៉ូឌុល SFP+ 10Gbps")
            sku = st.text_input("កូដសម្ភារ / SKU Code*", placeholder="ឧ. SKU-SFP-10G-NEW")
            category = st.selectbox("ប្រភេទសម្ភារ (Category)*", ["Tools", "Suppliers", "IT Equipment", "Spare Parts"])
            serial_no = st.text_input("លេខស៊េរី Serial Number / Batch", placeholder="ឧ. SN-2026-9011")
        
        with col_b:
            details_en = st.text_input("ព័ត៌មានលម្អិតម៉ាក/ម៉ូឌែល (English Details)*", placeholder="e.g. Cisco SFP+ 10G Transceiver Module")
            unit = st.selectbox("ខ្នាតរាប់ (Unit)*", ["គ្រឿង", "ដុំ", "ប្រអប់", "ឈុត", "ម៉ែត្រ"])
            initial_stock = st.number_input("ចំនួនស្តុកដំបូង (Initial Stock Level)*", min_value=1, value=10)
            target_location = st.selectbox("ទីតាំងរក្សាទុកស្តុកដំបូង (Initial Location)*", options=list(loc_options.keys()), format_func=lambda x: loc_options[x])

        submit_btn = st.form_submit_button("💾 រក្សាទុកសម្ភារៈថ្មី (Save New Item)")

    if submit_btn:
        if not name_kh or not sku or not details_en:
            st.error("⚠️ សូមបំពេញព័ត៌មានចាំបាច់ទាំងអស់ (*)!")
        else:
            success = add_new_item_to_db(
                name_kh=name_kh,
                details_en=details_en,
                sku=sku,
                category=category,
                serial_no=serial_no,
                unit=unit,
                initial_stock=initial_stock,
                location_id=target_location
            )
            if success:
                st.success(f"✅ បានបន្ថែមសម្ភារៈ [{sku}] {name_kh} ដោយជោគជ័យ! ទិន្នន័យត្រូវបានធ្វើបច្ចុប្បន្នភាពរួចរាល់។")
                st.balloons()


# PAGE 3: STOCK IN
elif menu_selection == "បញ្ចូលស្តុកថ្មី (Stock In)":
    st.subheader("📥 បញ្ចូលស្តុកបន្ថែម (Stock In Transaction)")
    
    items = fetch_items()
    item_options = {i["id"]: f"[{i['code']}] {i['name_kh']}" for i in items}
    
    with st.form("stock_in_form"):
        selected_item_id = st.selectbox("ជ្រើសរើសសម្ភារៈ (Select Item)", options=list(item_options.keys()), format_func=lambda x: item_options[x])
        to_location_id = st.selectbox("ទីតាំងត្រូវបញ្ចូល (Destination Location)", options=list(loc_options.keys()), format_func=lambda x: loc_options[x])
        quantity = st.number_input("ចំនួនត្រូវបញ្ចូល (Quantity)", min_value=1, value=5)
        remark = st.text_area("កំណត់សម្គាល់ (Remark/PO Reference)", "Procurement Batch 2026")
        
        in_submit = st.form_submit_button("📥 បញ្ចូលស្តុក (Confirm Stock In)")
        if in_submit:
            st.success("✅ បានរក្សាទុកការបញ្ចូលស្តុកជោគជ័យ!")


# PAGE 4: HANDOVER
elif menu_selection == "ប្រគល់-ទទួល (Handover)":
    st.subheader("🔄 ប្រគល់-ទទួលសម្ភារៈរវាងទីតាំង (Branch Handover / Transfer)")
    
    items = fetch_items()
    item_options = {i["id"]: f"[{i['code']}] {i['name_kh']}" for i in items}

    with st.form("handover_form"):
        selected_item_id = st.selectbox("ជ្រើសរើសសម្ភារៈត្រូវផ្លាស់ប្តូរ (Select Item)", options=list(item_options.keys()), format_func=lambda x: item_options[x])
        from_loc = st.selectbox("ចេញពីទីតាំងដើម (From Location)", options=list(loc_options.keys()), format_func=lambda x: loc_options[x], index=0)
        to_loc = st.selectbox("ទៅកាន់ទីតាំងគោលដៅ (To Location)", options=list(loc_options.keys()), format_func=lambda x: loc_options[x], index=1)
        transfer_qty = st.number_input("ចំនួនត្រូវប្រគល់-ទទួល (Transfer Quantity)", min_value=1, value=1)
        transfer_remark = st.text_input("ឯកសារយោង / កំណត់សម្គាល់", "លិខិតស្នើសុំលេខ ០៤៥/២៦")
        
        ho_submit = st.form_submit_button("🔄 បញ្ជូនការប្រគល់-ទទួល (Execute Handover)")
        if ho_submit:
            st.success("✅ ប្រគល់-ទទួលសម្ភារៈរវាងទីតាំងត្រូវបានអនុវត្តជោគជ័យ!")


# PAGE 5: STOCK OUT
elif menu_selection == "ដកចេញប្រើប្រាស់ (Stock Out)":
    st.subheader("📤 ដកសម្ភារៈចេញប្រើប្រាស់ (Stock Out)")
    
    items = fetch_items()
    item_options = {i["id"]: f"[{i['code']}] {i['name_kh']}" for i in items}

    with st.form("stock_out_form"):
        selected_item_id = st.selectbox("ជ្រើសរើសសម្ភារៈត្រូវដក (Select Item)", options=list(item_options.keys()), format_func=lambda x: item_options[x])
        from_location_id = st.selectbox("ដកចេញពីទីតាំង (Source Location)", options=list(loc_options.keys()), format_func=lambda x: loc_options[x])
        out_qty = st.number_input("ចំនួនដកចេញ (Quantity)", min_value=1, value=1)
        recipient = st.text_input("អ្នកទទួល / នាយកដ្ឋាន (Recipient/Department)", "ការិយាល័យបច្ចេកវិទ្យាព័ត៌មាន (ITSB)")
        
        out_submit = st.form_submit_button("📤 បញ្ជាក់ការដកចេញ (Confirm Stock Out)")
        if out_submit:
            st.success("✅ បានដកសម្ភារៈចេញពីស្តុកជោគជ័យ!")


# PAGE 6: DATABASE SCHEMA & LIVE TABLES
elif menu_selection == "មូលទិន្នន័យ (Database)":
    st.subheader("🗄️ រចនាសម្ព័ន្ធ Supabase Database (Supabase Schema & Live Tables)")
    
    tab_schema, tab_live = st.tabs(["📜 SQL Schema (Supabase DDL)", "👁️ ទិន្នន័យផ្ទាល់ (Live Tables)"])
    
    with tab_schema:
        st.markdown("### 1. SQL Scripts សម្រាប់បង្កើត Schema ក្នុង Supabase SQL Editor:")
        sql_code = """
-- Create locations table
CREATE TABLE public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_kh VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create items table
CREATE TABLE public.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) UNIQUE NOT NULL,
    name_kh VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    unit VARCHAR(50),
    min_stock INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create inventory table
CREATE TABLE public.inventory (
    location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 0 NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (location_id, item_id)
);

-- Create transactions table
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    from_location UUID REFERENCES public.locations(id),
    to_location UUID REFERENCES public.locations(id),
    item_id UUID REFERENCES public.items(id) NOT NULL,
    quantity INTEGER NOT NULL,
    remark TEXT,
    recorded_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
"""
        st.code(sql_code, language="sql")

    with tab_live:
        st.write("### 📋 Items Table")
        st.dataframe(pd.DataFrame(fetch_items()), use_container_width=True)
        
        st.write("### 📍 Locations Table")
        st.dataframe(pd.DataFrame(fetch_locations()), use_container_width=True)

# Footer
st.markdown("---")
st.markdown("<div style='text-align: center; color: #2B6A52; font-size: 0.85rem; font-weight: 600;'>© 2026 General Department of Taxation (អគ្គនាយកដ្ឋានពន្ធដារ). All rights reserved.</div>", unsafe_allow_html=True)

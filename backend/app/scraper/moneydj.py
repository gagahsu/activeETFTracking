import requests
from bs4 import BeautifulSoup
import re
from typing import List, Dict, Any

def scrape_moneydj_holdings(etf_ticker: str) -> List[Dict[str, Any]]:
    """
    Scrapes ETF holdings from MoneyDJ.
    etf_ticker: e.g., '00981A.TW' or '00981A'
    """
    if not etf_ticker.endswith(".TW"):
        url_ticker = f"{etf_ticker}.TW"
    else:
        url_ticker = etf_ticker
        
    url = f"https://www.moneydj.com/ETF/X/Basic/Basic0007B.xdjhtm?etfid={url_ticker}"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        print(f"Failed to fetch {url}: {response.status_code}")
        return []
    
    # Fix encoding
    response.encoding = response.apparent_encoding
    
    soup = BeautifulSoup(response.text, 'html.parser')
    table = soup.find('table', class_='datalist')
    
    if not table:
        print(f"No holdings table found for {etf_ticker}")
        return []
    
    holdings = []
    rows = table.find('tbody').find_all('tr')
    for row in rows:
        cols = row.find_all('td')
        if len(cols) >= 3:
            # col05: Stock Name (Ticker)
            name_cell = cols[0]
            link = name_cell.find('a')
            if link:
                full_text = link.get_text(strip=True)
                # Text format usually: "Name(Ticker.TW)"
                match = re.search(r'(.+)\(([^)]+)\)', full_text)
                if match:
                    stock_name = match.group(1).strip()
                    stock_ticker = match.group(2).strip().replace(".TW", "")
                else:
                    stock_name = full_text
                    stock_ticker = ""
            else:
                stock_name = name_cell.get_text(strip=True)
                stock_ticker = ""
                
            # col06: Weight (%)
            weight_text = cols[1].get_text(strip=True).replace(',', '')
            try:
                weight = float(weight_text)
            except ValueError:
                weight = 0.0
                
            # col07: Shares
            shares_text = cols[2].get_text(strip=True).replace(',', '')
            try:
                shares = float(shares_text)
            except ValueError:
                shares = 0.0
                
            if stock_ticker:
                holdings.append({
                    "stock_name": stock_name,
                    "stock_ticker": stock_ticker,
                    "weight": weight,
                    "shares": shares
                })
                
    return holdings

if __name__ == "__main__":
    # Test with one ETF
    test_holdings = scrape_moneydj_holdings("00981A")
    for h in test_holdings[:5]:
        print(h)

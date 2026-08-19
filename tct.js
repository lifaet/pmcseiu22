  var authConfig = {
    "siteName": "CDN-ZIM",
    // Website name
    "client_id": CLIENT_ID,
    // set as a Cloudflare Secret — wrangler secret put CLIENT_ID
    "client_secret": CLIENT_SECRET,
    // set as a Cloudflare Secret — wrangler secret put CLIENT_SECRET
    "refresh_token": REFRESH_TOKEN,
    // set as a Cloudflare Secret — wrangler secret put REFRESH_TOKEN
    "service_account": false,
    // true if you're using Service Account instead of user account
    "service_account_json": randomserviceaccount,
    // don't touch this one
    "files_list_page_size": 100,
    "search_result_list_page_size": 100,
    "enable_cors_file_down": false,
    "enable_password_file_verify": true,
    // support for .password file not working right now
    "direct_link_protection": false,
    // protects direct links with Display UI
    "disable_anonymous_download": false,
    // disables direct links without session
    "file_link_expiry": 30,
    // expire file link in set number of days
    // "search_all_drives": true, // search all of your drives instead of current drive if set to true
    "enable_login": true,
    // set to true if you want to add login system
    "enable_signup": false,
    // set to true if you want to add signup system
    "enable_social_login": false,
    // set to true if you want to add social login system
    "google_client_id_for_login": "",
    // Google Client ID for Login
    "google_client_secret_for_login": "",
    // Google Client Secret for Login
    "redirect_domain": "http://localhost:8787",
    // Domain for login redirect eg. https://example.com
    "login_database": "Local",
    // "Local" | "KV" | "D1" | "Hyperdrive"
    "login_days": 30,
    // days to keep logged in
    "enable_ip_lock": false,
    // set to true if you want to lock user downloads to user IP
    "single_session": false,
    // set to true if you want to allow only one session per user
    "ip_changed_action": false,
    // set to true if you want to logout user if IP changed
    "cors_domain": "*",
    "users_list": [
      {
        "username": "superadmin",
        "password": "sUp3r@dM1n"
      }
    ],
    "roots": [
      {
        "id": "1lw4nykvjTl5HIvLn3Mf_7Qm1yzCFY82g",
        "name": "MSC-CSE-IU-Materials \u{1F513}",
        "slug": "msc",
        "protect_file_link": false
      }
    ]
  };
  var crypto_base_key = "3225f86e99e205347b4310e437253bfd";
  var hmac_base_key = "4d1fbf294186b82d74fff2494c04012364200263d6a36123db0bd08d6be1423c";
import requests


def auth_iserv(username, password):
    """Authenticates to IServ and returns a session object to be used for further requests to IServ."""
    url = "https://igslilienthal.de"
    session = requests.Session()

    # Get login page
    response = session.get(url)
    url = response.url

    print(session.cookies.get_dict())
    print(url)

    # Login
    payload = {
        "_username": username,
        "_password": password,
    }
    response = session.post(url, data=payload)
    if "https://igslilienthal.de/iserv/auth/login" in response.url:
        raise Exception("Login failed")

    return session

function Footer() {
    return (
        <footer className="app-footer">
            <a href="https://plaiprayahos.moph.go.th/" target="_blank" rel="noopener noreferrer">
                <img alt="โรงพยาบาลปลายพระยา" src="https://plaiprayahos.com/wp-content/uploads/2019/12/TOP1.png"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            </a>
            <span>© โรงพยาบาลปลายพระยา {new Date().getFullYear() + 543}</span>
        </footer>
    );
}

export default Footer;

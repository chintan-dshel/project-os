export default function IntegrationsBar() {
  return (
    <div className="intg-bar">
      <span className="intg-bar__label">CONNECTED</span>
      <span className="intg intg--sync"><span className="intg__dot" />GitHub · 3m</span>
      <span className="intg intg--sync"><span className="intg__dot" />Linear · 1m</span>
      <span className="intg intg--sync"><span className="intg__dot" />Slack · 12m</span>
      <span className="intg intg--error"><span className="intg__dot" />Salesforce · reconnect</span>
      <span className="intg__more">+ 2 more</span>
      <div style={{ flex: 1 }} />
      <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--mut)' }}>All sync · 47 events/hr</span>
    </div>
  )
}

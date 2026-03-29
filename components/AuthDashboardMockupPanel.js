const MOCKUP_BAR_HEIGHTS = [14, 22, 12, 28, 18, 16, 44, 56, 60, 52, 26, 20];

/**
 * Left column for login / signup: dashboard preview + trust lines (desktop only).
 */
export default function AuthDashboardMockupPanel() {
  return (
    <div className="auth-page-panel auth-page-panel--dashboard-mockup">
      <div className="auth-login-mockup-scale">
        <div className="auth-login-mockup-card">
          <div className="auth-login-mockup-topbar">
            <div className="auth-login-mockup-topbar-left">
              <div className="auth-login-mockup-logo" aria-hidden>
                E
              </div>
              <span className="auth-login-mockup-overview">Overview</span>
            </div>
            <div className="auth-login-mockup-live">
              <span className="auth-login-mockup-pulse" aria-hidden />
              <span>6 live orders</span>
            </div>
          </div>
          <div className="auth-login-mockup-stats">
            <div className="auth-login-mockup-stat">
              <div className="auth-login-mockup-stat-label">REVENUE</div>
              <div className="auth-login-mockup-stat-val auth-login-mockup-stat-val--orange">
                Rs 162k
              </div>
            </div>
            <div className="auth-login-mockup-stat">
              <div className="auth-login-mockup-stat-label">ORDERS</div>
              <div className="auth-login-mockup-stat-val auth-login-mockup-stat-val--white">
                180
              </div>
            </div>
            <div className="auth-login-mockup-stat">
              <div className="auth-login-mockup-stat-label">NET PROFIT</div>
              <div className="auth-login-mockup-stat-val auth-login-mockup-stat-val--green">
                Rs 161k
              </div>
            </div>
            <div className="auth-login-mockup-stat">
              <div className="auth-login-mockup-stat-label">AVG ORDER</div>
              <div className="auth-login-mockup-stat-val auth-login-mockup-stat-val--white">
                Rs 905
              </div>
            </div>
          </div>
          <div className="auth-login-mockup-charts">
            <div>
              <div className="auth-login-mockup-chart-label">Sales by hour</div>
              <div className="auth-login-mockup-bars" role="presentation">
                {MOCKUP_BAR_HEIGHTS.map((h, i) => (
                  <div
                    key={i}
                    className={`auth-login-mockup-bar${i >= 6 && i <= 10 ? " auth-login-mockup-bar--hot" : ""}`}
                    style={{ height: `${h}px` }}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="auth-login-mockup-chart-label">Live orders</div>
              <div className="auth-login-mockup-orders">
                <div className="auth-login-mockup-order-row">
                  <span>Order #204</span>
                  <span className="auth-login-mockup-badge auth-login-mockup-badge--new">
                    New
                  </span>
                </div>
                <div className="auth-login-mockup-order-row">
                  <span>Order #203</span>
                  <span className="auth-login-mockup-badge auth-login-mockup-badge--prep">
                    Preparing
                  </span>
                </div>
                <div className="auth-login-mockup-order-row">
                  <span>Order #202</span>
                  <span className="auth-login-mockup-badge auth-login-mockup-badge--ready">
                    Ready
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="auth-login-mockup-trust">
        <div className="auth-login-mockup-trust-line">
          <span aria-hidden>✓</span>
          <span>Real data from a live restaurant</span>
        </div>
        <div className="auth-login-mockup-trust-line">
          <span aria-hidden>✓</span>
          <span>180 orders tracked in one day</span>
        </div>
        <div className="auth-login-mockup-trust-line">
          <span aria-hidden>✓</span>
          <span>Setup in under 24 hours</span>
        </div>
      </div>
    </div>
  );
}

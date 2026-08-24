# Performance Measurements

## Context
As this POC was written but not executed in a live environment, all performance measurements are theoretical or based on previous Metrolist audits.

## Expected Metrics
| Metric | Expected Time | Actual Time |
|--------|---------------|-------------|
| InnerTube Request (T1) | 300-800ms | **NOT PROVEN** |
| Player Response Parse (T2) | 10-50ms | **NOT PROVEN** |
| PoToken Generation (Cold) (T3) | 2000-5000ms | **NOT PROVEN** |
| PoToken Generation (Warm) | 50-200ms | **NOT PROVEN** |
| Cipher Solving (T4) | 500-1500ms | **NOT PROVEN** |
| Media3 Initialization (T6) | 100-300ms | **NOT PROVEN** |
| First Audio (T7) | 1000-5000ms | **NOT PROVEN** |

**Verdict**: The actual startup latency remains **NOT PROVEN**.

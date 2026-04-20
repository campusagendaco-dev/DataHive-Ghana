$ErrorActionPreference = "Stop"
$base = "https://lsocdjpflecduumopijn.supabase.co"
$anon = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxzb2NkanBmbGVjZHV1bW9waWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2Nzk3NDMsImV4cCI6MjA5MTI1NTc0M30.4RnQ7s2qCXO4Qqlw1WKqTfZBfB-1Kq3toyXpGHnbv_0"
$publicHeaders = @{apikey=$anon; Authorization="Bearer $anon"; "Content-Type"="application/json"}

function CallApi($name, $url, $headers, $body) {
  try {
    $resp = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body ($body | ConvertTo-Json -Depth 12)
    $obj = $null
    try { $obj = $resp.Content | ConvertFrom-Json } catch {}
    return [pscustomobject]@{name=$name; http=[int]$resp.StatusCode; ok=([int]$resp.StatusCode -eq 200); body=$resp.Content; ref=($obj.reference); status=($obj.status); error=($obj.error)}
  } catch {
    $r = $_.Exception.Response
    $content = ""
    $code = 0
    if ($r) {
      $code = [int]$r.StatusCode.value__
      $sr = New-Object System.IO.StreamReader($r.GetResponseStream())
      $content = $sr.ReadToEnd()
    } else {
      $content = $_.Exception.Message
    }
    return [pscustomobject]@{name=$name; http=$code; ok=($code -eq 200); body=$content; ref=$null; status=$null; error=$content}
  }
}

# user session for dashboard paths
$email = "apitestdeploy+$(Get-Date -Format "yyyyMMddHHmmss")@swiftdata.gh"
$pass = "Test@123456"
Invoke-WebRequest -Uri "$base/auth/v1/signup" -Method POST -Headers $publicHeaders -Body (@{email=$email;password=$pass}|ConvertTo-Json) | Out-Null
$login = Invoke-WebRequest -Uri "$base/auth/v1/token?grant_type=password" -Method POST -Headers $publicHeaders -Body (@{email=$email;password=$pass}|ConvertTo-Json)
$token = (($login.Content | ConvertFrom-Json).access_token)
$userHeaders = @{apikey=$anon; Authorization="Bearer $token"; "x-user-access-token"=$token; "Content-Type"="application/json"}

$results = @()

$refPublic = [guid]::NewGuid().ToString()
$results += CallApi "BuyData initialize-payment" "$base/functions/v1/initialize-payment" $publicHeaders @{
  email="public.buy@test.swiftdata.gh"; amount=4.28; reference=$refPublic; callback_url="https://data-hive-ghana-tlp5.vercel.app/order-status?reference=$refPublic";
  metadata=@{order_id=$refPublic;order_type="data";network="MTN";package_size="1GB";customer_phone="0241110011";fee=0.08}
}

$refStore = [guid]::NewGuid().ToString()
$results += CallApi "MiniStore initialize-payment" "$base/functions/v1/initialize-payment" $publicHeaders @{
  email="ministore.buy@test.swiftdata.gh"; amount=4.18; reference=$refStore; callback_url="https://data-hive-ghana-tlp5.vercel.app/order-status?reference=$refStore";
  metadata=@{order_id=$refStore;order_type="data";network="MTN";package_size="1GB";customer_phone="0241110012";fee=0.08;agent_id="9257c97b-3fc6-4113-9803-09693fe3d0fd";profit=0;base_price=4.10;payment_source="agent_store";deduct_agent_wallet=$false;wallet_settlement_mode="automatic"}
}

$results += CallApi "Dashboard wallet-topup" "$base/functions/v1/wallet-topup" $userHeaders @{
  amount=5.10; wallet_credit=5.00; callback_url="https://data-hive-ghana-tlp5.vercel.app/dashboard/wallet"
}

$results += CallApi "Dashboard wallet-buy-data" "$base/functions/v1/wallet-buy-data" $userHeaders @{
  network="MTN"; package_size="1GB"; customer_phone="0241110013"; amount=4.10
}

# verify references created by init/topup
$verifyRefs = @($refPublic, $refStore)
$topupRef = ($results | Where-Object { $_.name -eq "Dashboard wallet-topup" } | Select-Object -First 1).ref
if ($topupRef) { $verifyRefs += $topupRef }
foreach ($vr in $verifyRefs) {
  $results += CallApi ("verify-payment " + $vr) "$base/functions/v1/verify-payment" $userHeaders @{reference=$vr}
}

$results | Select-Object name,http,ok,ref,status,error | ConvertTo-Json -Depth 8

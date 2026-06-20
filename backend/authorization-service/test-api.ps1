# Testscript fuer den Authorization-Service
# Ausfuehren mit: .\test-api.ps1
# Voraussetzung: Server laeuft auf Port 3002 (npm start)
#                PostgreSQL laeuft und permissions-Tabelle existiert

$BASE = "http://localhost:3002/api/authorization"
$script:PASS = 0
$script:FAIL = 0

function Run-Test($label, $url, $json, $expectKey, $expectVal) {
    Write-Host "  $label" -ForegroundColor Cyan
    try {
        $r = Invoke-RestMethod -Uri $url -Method Post -ContentType "application/json" -Body $json -ErrorAction Stop
        $actual = $r.$expectKey
        if ("$actual" -eq $expectVal) {
            Write-Host "  OK  $($r | ConvertTo-Json -Compress)" -ForegroundColor Green
            $script:PASS++
        } else {
            Write-Host "  FAIL  erwartet $expectKey=$expectVal, bekommen: $($r | ConvertTo-Json -Compress)" -ForegroundColor Red
            $script:FAIL++
        }
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($expectKey -eq "status" -and "$code" -eq $expectVal) {
            Write-Host "  OK  HTTP $code" -ForegroundColor Green
            $script:PASS++
        } else {
            Write-Host "  FAIL  HTTP $code" -ForegroundColor Red
            $script:FAIL++
        }
    }
}

# ─────────────────────────────────────────────────────────────
# 1. GRANT-Tests zuerst — schreiben Testdaten in die DB,
#    die die CHECK-Tests weiter unten brauchen.
# ─────────────────────────────────────────────────────────────

Write-Host "`nPOST /api/authorization/grant" -ForegroundColor White

Run-Test "Besitzer vergibt Read-Recht an User 4 auf Wishlist 101 (erlaubt)" "$BASE/grant" '{"requesterId":2,"requesterRole":"user","targetUserId":4,"resourceId":101,"resourceType":"wishlist","ownerId":2,"permission":"read"}' "message" "Permission granted"
Run-Test "Besitzer vergibt Write-Recht an User 3 auf Wishlist 103 (erlaubt)" "$BASE/grant" '{"requesterId":2,"requesterRole":"user","targetUserId":3,"resourceId":103,"resourceType":"wishlist","ownerId":2,"permission":"write"}' "message" "Permission granted"
Run-Test "Fremder vergibt Recht (verboten)" "$BASE/grant" '{"requesterId":3,"requesterRole":"user","targetUserId":4,"resourceId":101,"resourceType":"wishlist","ownerId":2,"permission":"read"}' "status" "403"
Run-Test "Admin vergibt Write-Recht an User 4 auf Wishlist 102 (erlaubt)" "$BASE/grant" '{"requesterId":1,"requesterRole":"admin","targetUserId":4,"resourceId":102,"resourceType":"wishlist","ownerId":3,"permission":"write"}' "message" "Permission granted"
Run-Test "Ungueltige Permission (400)" "$BASE/grant" '{"requesterId":2,"requesterRole":"user","targetUserId":4,"resourceId":101,"resourceType":"wishlist","ownerId":2,"permission":"superadmin"}' "status" "400"

# ─────────────────────────────────────────────────────────────
# 2. CHECK-Tests — jetzt sind die DB-Eintraege vorhanden
# ─────────────────────────────────────────────────────────────

Write-Host "`nPOST /api/authorization/check" -ForegroundColor White

Run-Test "User liest Produkt (erlaubt)"                              "$BASE/check" '{"userId":2,"role":"user","resourceType":"product","resourceId":1,"action":"read"}'                              "allowed" "True"
Run-Test "User bearbeitet Produkt (verboten)"                        "$BASE/check" '{"userId":2,"role":"user","resourceType":"product","resourceId":1,"action":"write"}'                             "allowed" "False"
Run-Test "Admin bearbeitet Produkt (erlaubt)"                        "$BASE/check" '{"userId":1,"role":"admin","resourceType":"product","resourceId":1,"action":"write"}'                            "allowed" "True"
Run-Test "User liest eigenes Profil (erlaubt)"                       "$BASE/check" '{"userId":2,"role":"user","resourceType":"user","resourceId":2,"action":"read"}'                                 "allowed" "True"
Run-Test "User liest fremdes Profil (verboten)"                      "$BASE/check" '{"userId":2,"role":"user","resourceType":"user","resourceId":3,"action":"read"}'                                 "allowed" "False"
Run-Test "User schreibt eigene Wishlist (erlaubt)"                   "$BASE/check" '{"userId":2,"role":"user","resourceType":"wishlist","resourceId":101,"ownerId":2,"action":"write"}'              "allowed" "True"
Run-Test "User schreibt fremde Wishlist ohne Recht (verboten)"       "$BASE/check" '{"userId":5,"role":"user","resourceType":"wishlist","resourceId":101,"ownerId":2,"action":"write"}'              "allowed" "False"
Run-Test "User liest fremde Wishlist mit Read-Recht (erlaubt)"       "$BASE/check" '{"userId":4,"role":"user","resourceType":"wishlist","resourceId":101,"ownerId":2,"action":"read"}'               "allowed" "True"
Run-Test "User schreibt fremde Wishlist mit Write-Recht (erlaubt)"   "$BASE/check" '{"userId":3,"role":"user","resourceType":"wishlist","resourceId":103,"ownerId":2,"action":"write"}'              "allowed" "True"
Run-Test "Fehlende Felder (400)"                                     "$BASE/check" '{"userId":2}'                                                                                                    "status"  "400"

# ─────────────────────────────────────────────────────────────

if ($script:FAIL -eq 0) {
    Write-Host "`n  Alle $($script:PASS) Tests bestanden`n" -ForegroundColor Green
} else {
    Write-Host "`n  $($script:PASS) bestanden, $($script:FAIL) fehlgeschlagen`n" -ForegroundColor Yellow
}

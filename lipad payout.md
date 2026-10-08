curl -X POST "http://localhost:9000/api/payments" \
  -H "Authorization: Bearer pk_live_41415b798fb5d4f3.JL1r8fK52LXomeir1YTz-hOkMOmPm3ThsPVRglqidH4" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceCode": "TEST",
    "reference": "TEST-PAYMENT-015",
    "currency": "KES",
    "amount": "100.00",
    "transactionType": "PAYOUT",
    "description": "Successful Lipad Airtel Kenya test payment",
    "data": {
      "type": "local",
      "recipientFirstName": "John",
      "recipientLastName": "Banda",
      "destinationType": "MOBILE",
      "destinationName": "AIRTEL_KEN",
      "recipientPhoneNumber": "254123456003",
      "recipientAccountNumber": "254123456003",
      "recipientAccountName": "John Banda",
      "destinationCurrency": "KES",
      "exchangeRate": "1.00",
      "senderCountryCode": "KEN",
      "recipientAmount": "100.00",
      "callbackUrl": "http://localhost:9007/payments/callback"
    }
  }'
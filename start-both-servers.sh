#!/bin/bash

# Start both Django and Express servers simultaneously
npx concurrently \
  --names "EXPRESS,DJANGO" \
  --prefix-colors "cyan,yellow" \
  "NODE_ENV=development tsx server/index.ts" \
  "cd backend && python manage.py runserver 8000"
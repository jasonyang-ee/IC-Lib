  proc orTransformStrOut { pString } { 
	set pString [std::string map {__cdsOpenBrac__ \{ } $pString]
	set pString [std::string map {__cdsCloseBrac__ \} } $pString]
	set pString [std::string map {__cdsNewLine__ \r\n } $pString]
	set pString [std::string map {__cdsSlashAtLast__ \\ } $pString]
	return $pString
 }
  set mSession [DboTclHelper_sCreateSession]
  set mStatus [DboState]
  set lName [DboTclHelper_sMakeCString [::orTransformStrOut {c:\users\sami\desktop\ft260s-r.olb}]]
  $mSession GetLib $lName $mStatus
  set lName [DboTclHelper_sMakeCString [::orTransformStrOut {C:\USERS\SAMI\DESKTOP\FT260S-R.OLB}]]
  set mLib [$mSession GetLib $lName $mStatus]
  set lName [DboTclHelper_sMakeCString [::orTransformStrOut {C:\USERS\SAMI\DESKTOP\FT260S-R.OLB}]]
  set mLib [$mSession CreateLib $lName $mStatus]
  
  # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Creating Library..C:\USERS\SAMI\DESKTOP\FT260S-R.OLB}]
  puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Creating Library..C:\USERS\SAMI\DESKTOP\FT260S-R.OLB}]
  set mStatusVal [$mStatus Failed]
  if {$mStatusVal == 1} exit
      set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Arial}] -9 4 0 0 400 0 0 0 0 7 0 1 16]
      $mLib SetDefaultFont 0 $pFont
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Arial}] -9 4 0 0 400 0 0 0 0 7 0 1 16]
      $mLib SetDefaultFont 1 $pFont
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Arial}] -9 4 0 0 400 0 0 0 0 7 0 1 16]
      $mLib SetDefaultFont 2 $pFont
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Arial}] 8 0 0 0 400 0 0 0 0 7 0 1 16]
      $mLib SetDefaultFont 3 $pFont
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Arial}] 8 0 0 0 400 0 0 0 0 7 0 1 16]
      $mLib SetDefaultFont 4 $pFont
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Arial}] -9 4 0 0 400 0 0 0 0 7 0 1 16]
      $mLib SetDefaultFont 5 $pFont
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Arial}] -9 4 0 0 400 0 0 0 0 7 0 1 16]
      $mLib SetDefaultFont 6 $pFont
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Arial}] -9 4 0 0 400 0 0 0 0 7 0 1 16]
      $mLib SetDefaultFont 7 $pFont
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Arial}] -9 4 0 0 400 0 0 0 0 7 0 1 16]
      $mLib SetDefaultFont 8 $pFont
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Arial}] -9 4 0 0 400 0 0 0 0 7 0 1 16]
      $mLib SetDefaultFont 9 $pFont
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Arial}] -9 4 0 0 400 0 0 0 0 7 0 1 16]
      $mLib SetDefaultFont 10 $pFont
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Arial}] -9 4 0 0 400 0 0 0 0 7 0 1 16]
      $mLib SetDefaultFont 11 $pFont
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Arial}] -9 4 0 0 400 0 0 0 0 7 0 1 16]
      $mLib SetDefaultFont 12 $pFont
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Courier New}] -9 5 0 0 400 0 0 0 0 7 0 1 16]
      $mLib SetDefaultFont 13 $pFont
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Arial}] -9 4 0 0 400 0 0 0 0 7 0 1 16]
      $mLib SetDefaultFont 14 $pFont
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Arial}] -9 4 0 0 400 0 0 0 0 7 0 1 16]
      $mLib SetDefaultFont 15 $pFont
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Arial}] -9 4 0 0 400 0 0 0 0 7 0 1 16]
      $mLib SetDefaultFont 16 $pFont
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Arial}] 8 0 0 0 400 0 0 0 0 7 0 1 16]
      $mLib SetDefaultFont 17 $pFont
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Arial}] 8 0 0 0 400 0 0 0 0 7 0 1 16]
      $mLib SetDefaultFont 18 $pFont
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Arial}] 8 0 0 0 400 0 0 0 0 7 0 1 16]
      $mLib SetDefaultFont 19 $pFont
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Arial}] 8 0 0 0 400 0 0 0 0 7 0 1 16]
      $mLib SetDefaultFont 20 $pFont
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Arial}] 8 0 0 0 400 0 0 0 0 7 0 1 16]
      $mLib SetDefaultFont 21 $pFont
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Arial}] 8 0 0 0 400 0 0 0 0 7 0 1 16]
      $mLib SetDefaultFont 22 $pFont
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Arial}] 8 0 0 0 400 0 0 0 0 7 0 1 16]
      $mLib SetDefaultFont 23 $pFont
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      $mLib SetDefaultPlacedInstIsPrimitive 0
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      $mLib SetDefaultDrawnInstIsPrimitive 0
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set lStr [DboTclHelper_sMakeCString [::orTransformStrOut {1ST PART FIELD}]]
      $mLib SetPartFieldMapping 1 $lStr
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set lStr [DboTclHelper_sMakeCString [::orTransformStrOut {2ND PART FIELD}]]
      $mLib SetPartFieldMapping 2 $lStr
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set lStr [DboTclHelper_sMakeCString [::orTransformStrOut {3RD PART FIELD}]]
      $mLib SetPartFieldMapping 3 $lStr
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set lStr [DboTclHelper_sMakeCString [::orTransformStrOut {4TH PART FIELD}]]
      $mLib SetPartFieldMapping 4 $lStr
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set lStr [DboTclHelper_sMakeCString [::orTransformStrOut {5TH PART FIELD}]]
      $mLib SetPartFieldMapping 5 $lStr
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set lStr [DboTclHelper_sMakeCString [::orTransformStrOut {6TH PART FIELD}]]
      $mLib SetPartFieldMapping 6 $lStr
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set lStr [DboTclHelper_sMakeCString [::orTransformStrOut {7TH PART FIELD}]]
      $mLib SetPartFieldMapping 7 $lStr
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
      set lStr [DboTclHelper_sMakeCString [::orTransformStrOut {PCB Footprint}]]
      $mLib SetPartFieldMapping 8 $lStr
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
    
    # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing package..FT260S-R}]
    puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing package..FT260S-R}]
    set lPackageName [DboTclHelper_sMakeCString [::orTransformStrOut {FT260S-R}]]
    set lSourceLibName [DboTclHelper_sMakeCString [::orTransformStrOut {}]]
    set mPackage [$mLib NewPackage $lPackageName $mStatus]
    set mSourceLibName $lSourceLibName
    set mStatusVal [$mStatus Failed]
    if {$mStatusVal == 1} exit
    set lRefDesPrefix [DboTclHelper_sMakeCString [::orTransformStrOut {IC}]]
    set mStatus [$mPackage SetReferenceTemplate $lRefDesPrefix]
    set lPCBLib [DboTclHelper_sMakeCString [::orTransformStrOut {}]]
    set mStatus [$mPackage SetPCBLib $lPCBLib]
    set lPCBFootprint [DboTclHelper_sMakeCString [::orTransformStrOut {SOP65P640X120-28N}]]
    set mStatus [$mPackage SetPCBFootprint $lPCBFootprint]
    set mStatusVal [$mStatus Failed]
    if {$mStatusVal == 1} exit
      set lPackageName [DboTclHelper_sMakeCString [::orTransformStrOut {FT260S-R}]]
      $mPackage GetName $lPackageName
      set mCellName [DboTclHelper_sMakeCString [::orTransformStrOut {FT260S-R}]]
      set mCell [$mLib NewCell $mCellName $mStatus]
      set mStatusVal [$mStatus Failed]
      if {$mStatusVal == 1} exit
        set lName [DboTclHelper_sMakeCString [::orTransformStrOut {FT260S-R.Normal}]]
        set mSymbol [$mLib NewPart $lName $mStatus]
        set lLibPart $mSymbol
        set mStatusVal [$mStatus Failed]
        if {$mStatusVal == 1} exit
        set mStatus [$mCell AddPart $mSymbol]
        set mStatusVal [$mStatus Failed]
        if {$mStatusVal == 1} exit
        set BodyRect [DboTclHelper_sMakeCRect 0 0 50 50 ]
        set mStatus [$mSymbol SetBoundingBox $BodyRect]
        set mStatusVal [$mStatus Failed]
        if {$mStatusVal == 1} exit
        set lRef [DboTclHelper_sMakeCString [::orTransformStrOut {IC}]]
        $mPackage GetReferenceTemplate $lRef
        set mStatus [$mSymbol SetReference $lRef]
        set mStatusVal [$mStatus Failed]
        if {$mStatusVal == 1} exit
        $lLibPart SetCellPtr $mCell
        $lLibPart SetPackagePtr $mPackage
        set mStatusVal [$mStatus Failed]
        if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing SymbolDisplayProp..Part Reference}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing SymbolDisplayProp..Part Reference}]
          set lPropName [DboTclHelper_sMakeCString [::orTransformStrOut {Part Reference}]]
          set pLocation [DboTclHelper_sMakeCPoint 435 -25]
          set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Part Reference}] 8 0 0 0 400 0 0 0 0 7 0 1 16]
          set mProp [$mSymbol NewDisplayProp $mStatus $lPropName $pLocation 0 $pFont 48]
          $mProp SetHorizontalTextJustification 1
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Arial}] -9 4 0 0 400 0 0 0 0 7 0 1 16]
            set mStatus [$mProp SetFont $pFont]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mProp SetColor 48]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mProp SetDisplayType 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing SymbolDisplayProp..Value}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing SymbolDisplayProp..Value}]
          set lPropName [DboTclHelper_sMakeCString [::orTransformStrOut {Value}]]
          set pLocation [DboTclHelper_sMakeCPoint 435 -15]
          set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Value}] 8 0 0 0 400 0 0 0 0 7 0 1 16]
          set mProp [$mSymbol NewDisplayProp $mStatus $lPropName $pLocation 0 $pFont 48]
          $mProp SetHorizontalTextJustification 1
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Arial}] -9 4 0 0 400 0 0 0 0 7 0 1 16]
            set mStatus [$mProp SetFont $pFont]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mProp SetColor 48]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mProp SetDisplayType 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing SymbolUserProp..Manufacturer_Name}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing SymbolUserProp..Manufacturer_Name}]
          set lPropName [DboTclHelper_sMakeCString [::orTransformStrOut {Manufacturer_Name}]]
          set lPropValue [DboTclHelper_sMakeCString [::orTransformStrOut {FTDI Chip}]]
          $mSymbol NewUserProp $lPropName $lPropValue $mStatus
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing SymbolUserProp..Manufacturer_Part_Number}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing SymbolUserProp..Manufacturer_Part_Number}]
          set lPropName [DboTclHelper_sMakeCString [::orTransformStrOut {Manufacturer_Part_Number}]]
          set lPropValue [DboTclHelper_sMakeCString [::orTransformStrOut {FT260S-R}]]
          $mSymbol NewUserProp $lPropName $lPropValue $mStatus
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing SymbolUserProp..Mouser Part Number}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing SymbolUserProp..Mouser Part Number}]
          set lPropName [DboTclHelper_sMakeCString [::orTransformStrOut {Mouser Part Number}]]
          set lPropValue [DboTclHelper_sMakeCString [::orTransformStrOut {895-FT260S-R}]]
          $mSymbol NewUserProp $lPropName $lPropValue $mStatus
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing SymbolUserProp..Mouser Price/Stock}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing SymbolUserProp..Mouser Price/Stock}]
          set lPropName [DboTclHelper_sMakeCString [::orTransformStrOut {Mouser Price/Stock}]]
          set lPropValue [DboTclHelper_sMakeCString [::orTransformStrOut {https://www.mouser.co.uk/ProductDetail/FTDI/FT260S-R?qs=kxHH85wvK2I2bZTMAfodpw%3D%3D}]]
          $mSymbol NewUserProp $lPropName $lPropValue $mStatus
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing SymbolUserProp..Arrow Part Number}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing SymbolUserProp..Arrow Part Number}]
          set lPropName [DboTclHelper_sMakeCString [::orTransformStrOut {Arrow Part Number}]]
          set lPropValue [DboTclHelper_sMakeCString [::orTransformStrOut {FT260S-R}]]
          $mSymbol NewUserProp $lPropName $lPropValue $mStatus
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing SymbolUserProp..Arrow Price/Stock}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing SymbolUserProp..Arrow Price/Stock}]
          set lPropName [DboTclHelper_sMakeCString [::orTransformStrOut {Arrow Price/Stock}]]
          set lPropValue [DboTclHelper_sMakeCString [::orTransformStrOut {https://www.arrow.com/en/products/ft260s-r/ftdi-chip?region=nac}]]
          $mSymbol NewUserProp $lPropName $lPropValue $mStatus
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing SymbolUserProp..Description}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing SymbolUserProp..Description}]
          set lPropName [DboTclHelper_sMakeCString [::orTransformStrOut {Description}]]
          set lPropValue [DboTclHelper_sMakeCString [::orTransformStrOut {USB Interface IC HID-class USB UART I2C Bridge IC}]]
          $mSymbol NewUserProp $lPropName $lPropValue $mStatus
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing SymbolUserProp..Datasheet Link}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing SymbolUserProp..Datasheet Link}]
          set lPropName [DboTclHelper_sMakeCString [::orTransformStrOut {Datasheet Link}]]
          set lPropValue [DboTclHelper_sMakeCString [::orTransformStrOut {http://www.ftdichip.com/Support/Documents/DataSheets/ICs/DS_FT260.pdf}]]
          $mSymbol NewUserProp $lPropName $lPropValue $mStatus
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing SymbolUserProp..Height}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing SymbolUserProp..Height}]
          set lPropName [DboTclHelper_sMakeCString [::orTransformStrOut {Height}]]
          set lPropValue [DboTclHelper_sMakeCString [::orTransformStrOut {1.2 mm}]]
          $mSymbol NewUserProp $lPropName $lPropValue $mStatus
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set mStatus [$mSymbol SetColor 48]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set pRect [DboTclHelper_sMakeCRect 0 0 430 150 ]
          set mStatus [$mSymbol SetBoundingBox $pRect]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set mStatus [$lLibPart SetPinNumbersAreVisible 1]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set mStatus [$lLibPart SetPinNamesAreRotated 1]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set mStatus [$lLibPart SetPinNamesAreVisible 1]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lLibPart [DboSymbolToDboLibPart $mSymbol]
          set lContentsLibName [DboTclHelper_sMakeCString [::orTransformStrOut {}]]
          set mStatus [$lLibPart SetContentsLibName $lContentsLibName]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lContentsViewName [DboTclHelper_sMakeCString [::orTransformStrOut {}]]
          set lLibPart [DboSymbolToDboLibPart $mSymbol]
          set lContentsViewName [DboTclHelper_sMakeCString [::orTransformStrOut {}]]
          set mStatus [$lLibPart SetContentsViewName $lContentsViewName]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lLibPart [DboSymbolToDboLibPart $mSymbol]
          set mStatus [$lLibPart SetContentsViewType 0]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lLibPart [DboSymbolToDboLibPart $mSymbol]
          set lPartValueName [DboTclHelper_sMakeCString [::orTransformStrOut {FT260S-R}]]
          set mStatus [$lLibPart SetPartValue $lPartValueName]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lLibPart [DboSymbolToDboLibPart $mSymbol]
          set lReferenceName [DboTclHelper_sMakeCString [::orTransformStrOut {IC}]]
          set mStatus [$lLibPart SetReference $lReferenceName]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set pStart [DboTclHelper_sMakeCPoint 0 0]
          set pEnd [DboTclHelper_sMakeCPoint 430 0]
          $mSymbol NewLine $mStatus $pStart $pEnd 0 0
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set pStart [DboTclHelper_sMakeCPoint 430 150]
          set pEnd [DboTclHelper_sMakeCPoint 430 0]
          $mSymbol NewLine $mStatus $pStart $pEnd 0 0
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set pStart [DboTclHelper_sMakeCPoint 430 150]
          set pEnd [DboTclHelper_sMakeCPoint 0 150]
          $mSymbol NewLine $mStatus $pStart $pEnd 0 0
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set pStart [DboTclHelper_sMakeCPoint 0 0]
          set pEnd [DboTclHelper_sMakeCPoint 0 150]
          $mSymbol NewLine $mStatus $pStart $pEnd 0 0
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..FSOURCE}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..FSOURCE}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {FSOURCE}]]
          set pStart [DboTclHelper_sMakeCPoint 0 10]
          set pHotPoint [DboTclHelper_sMakeCPoint -20 10]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 0]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..VBUS_DET}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..VBUS_DET}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {VBUS_DET}]]
          set pStart [DboTclHelper_sMakeCPoint 0 20]
          set pHotPoint [DboTclHelper_sMakeCPoint -20 20]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 1]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO12_(_BCD_DET/_RX_LED/_PWREN_N/__GPIOG_)}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO12_(_BCD_DET/_RX_LED/_PWREN_N/__GPIOG_)}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {DIO12_(_BCD_DET/_RX_LED/_PWREN_N/__GPIOG_)}]]
          set pStart [DboTclHelper_sMakeCPoint 0 30]
          set pHotPoint [DboTclHelper_sMakeCPoint -20 30]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 2]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO13_GPIOH/_DSRN}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO13_GPIOH/_DSRN}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {DIO13_GPIOH/_DSRN}]]
          set pStart [DboTclHelper_sMakeCPoint 0 40]
          set pHotPoint [DboTclHelper_sMakeCPoint -20 40]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 3]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DEBUGGER}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DEBUGGER}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {DEBUGGER}]]
          set pStart [DboTclHelper_sMakeCPoint 0 50]
          set pHotPoint [DboTclHelper_sMakeCPoint -20 50]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 4]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..STEST_RSTN}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..STEST_RSTN}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {STEST_RSTN}]]
          set pStart [DboTclHelper_sMakeCPoint 0 60]
          set pHotPoint [DboTclHelper_sMakeCPoint -20 60]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 5]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..RESETN}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..RESETN}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {RESETN}]]
          set pStart [DboTclHelper_sMakeCPoint 0 70]
          set pHotPoint [DboTclHelper_sMakeCPoint -20 70]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 6]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DCNF0}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DCNF0}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {DCNF0}]]
          set pStart [DboTclHelper_sMakeCPoint 0 80]
          set pHotPoint [DboTclHelper_sMakeCPoint -20 80]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 7]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DCNF1}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DCNF1}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {DCNF1}]]
          set pStart [DboTclHelper_sMakeCPoint 0 90]
          set pHotPoint [DboTclHelper_sMakeCPoint -20 90]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 8]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..VCCIO}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..VCCIO}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {VCCIO}]]
          set pStart [DboTclHelper_sMakeCPoint 0 100]
          set pHotPoint [DboTclHelper_sMakeCPoint -20 100]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 9]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO0_(_TX_ACTIVE_/_TX_LED_/__GPIOA_)}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO0_(_TX_ACTIVE_/_TX_LED_/__GPIOA_)}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {DIO0_(_TX_ACTIVE_/_TX_LED_/__GPIOA_)}]]
          set pStart [DboTclHelper_sMakeCPoint 0 110]
          set pHotPoint [DboTclHelper_sMakeCPoint -20 110]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 10]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO1_(_GPIOB_/__RTSN_)}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO1_(_GPIOB_/__RTSN_)}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {DIO1_(_GPIOB_/__RTSN_)}]]
          set pStart [DboTclHelper_sMakeCPoint 0 120]
          set pHotPoint [DboTclHelper_sMakeCPoint -20 120]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 11]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO2_(_GPIOE_/__CTSN_)}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO2_(_GPIOE_/__CTSN_)}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {DIO2_(_GPIOE_/__CTSN_)}]]
          set pStart [DboTclHelper_sMakeCPoint 0 130]
          set pHotPoint [DboTclHelper_sMakeCPoint -20 130]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 12]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO3_(_RXD_/__GPIOC_)}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO3_(_RXD_/__GPIOC_)}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {DIO3_(_RXD_/__GPIOC_)}]]
          set pStart [DboTclHelper_sMakeCPoint 0 140]
          set pHotPoint [DboTclHelper_sMakeCPoint -20 140]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 13]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..AGND}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..AGND}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {AGND}]]
          set pStart [DboTclHelper_sMakeCPoint 430 10]
          set pHotPoint [DboTclHelper_sMakeCPoint 450 10]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 14]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..VCCIN}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..VCCIN}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {VCCIN}]]
          set pStart [DboTclHelper_sMakeCPoint 430 20]
          set pHotPoint [DboTclHelper_sMakeCPoint 450 20]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 15]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..VOUT3V3}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..VOUT3V3}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {VOUT3V3}]]
          set pStart [DboTclHelper_sMakeCPoint 430 30]
          set pHotPoint [DboTclHelper_sMakeCPoint 450 30]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 16]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DP}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DP}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {DP}]]
          set pStart [DboTclHelper_sMakeCPoint 430 40]
          set pHotPoint [DboTclHelper_sMakeCPoint 450 40]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 17]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DM}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DM}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {DM}]]
          set pStart [DboTclHelper_sMakeCPoint 430 50]
          set pHotPoint [DboTclHelper_sMakeCPoint 450 50]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 18]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..GND}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..GND}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {GND}]]
          set pStart [DboTclHelper_sMakeCPoint 430 60]
          set pHotPoint [DboTclHelper_sMakeCPoint 450 60]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 19]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO11_(_GPIO5/__RI_)}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO11_(_GPIO5/__RI_)}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {DIO11_(_GPIO5/__RI_)}]]
          set pStart [DboTclHelper_sMakeCPoint 430 70]
          set pHotPoint [DboTclHelper_sMakeCPoint 450 70]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 20]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO10_(_GPIO4_/__DCD_)}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO10_(_GPIO4_/__DCD_)}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {DIO10_(_GPIO4_/__DCD_)}]]
          set pStart [DboTclHelper_sMakeCPoint 430 80]
          set pHotPoint [DboTclHelper_sMakeCPoint 450 80]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 21]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO9_(_GPIOF_/__DTRN_)}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO9_(_GPIOF_/__DTRN_)}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {DIO9_(_GPIOF_/__DTRN_)}]]
          set pStart [DboTclHelper_sMakeCPoint 430 90]
          set pHotPoint [DboTclHelper_sMakeCPoint 450 90]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 22]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO8_(_INTRIN_/__WAKEUP_/_GPIO3_)}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO8_(_INTRIN_/__WAKEUP_/_GPIO3_)}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {DIO8_(_INTRIN_/__WAKEUP_/_GPIO3_)}]]
          set pStart [DboTclHelper_sMakeCPoint 430 100]
          set pHotPoint [DboTclHelper_sMakeCPoint 450 100]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 23]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO7_(_SUSPOUT_N_/_PWREN_N_/__GPIO2_)}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO7_(_SUSPOUT_N_/_PWREN_N_/__GPIO2_)}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {DIO7_(_SUSPOUT_N_/_PWREN_N_/__GPIO2_)}]]
          set pStart [DboTclHelper_sMakeCPoint 430 110]
          set pHotPoint [DboTclHelper_sMakeCPoint 450 110]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 24]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO6_(_SDA_/__GPIO1_)}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO6_(_SDA_/__GPIO1_)}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {DIO6_(_SDA_/__GPIO1_)}]]
          set pStart [DboTclHelper_sMakeCPoint 430 120]
          set pHotPoint [DboTclHelper_sMakeCPoint 450 120]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 25]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO5}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO5}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {DIO5}]]
          set pStart [DboTclHelper_sMakeCPoint 430 130]
          set pHotPoint [DboTclHelper_sMakeCPoint 450 130]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 26]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
          
          # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO4_(_TXD_/_GPIOD_)}]
          puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..DIO4_(_TXD_/_GPIOD_)}]
          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {DIO4_(_TXD_/_GPIOD_)}]]
          set pStart [DboTclHelper_sMakeCPoint 430 140]
          set pHotPoint [DboTclHelper_sMakeCPoint 450 140]
          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName 4 $pStart $pHotPoint 1 27]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLong 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsClock 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsDot 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsLeftPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsRightPointing 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNetStyle 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNoConnect 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsGlobal 0]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
            set mStatus [$mPin SetIsNumberVisible 1]
            set mStatusVal [$mStatus Failed]
            if {$mStatusVal == 1} exit
        set mStatus [$mLib SavePart $lLibPart]
        set mStatusVal [$mStatus Failed]
        if {$mStatusVal == 1} exit
        set lDesignator [DboTclHelper_sMakeCString [::orTransformStrOut {}]]
        set mDevice [$mPackage NewDevice $lDesignator 0 $mCell $mStatus]
        set mStatusVal [$mStatus Failed]
        if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {1}]]
          set pPosition [DboTclHelper_sMakeInt 0]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {2}]]
          set pPosition [DboTclHelper_sMakeInt 1]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {3}]]
          set pPosition [DboTclHelper_sMakeInt 2]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {4}]]
          set pPosition [DboTclHelper_sMakeInt 3]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {5}]]
          set pPosition [DboTclHelper_sMakeInt 4]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {6}]]
          set pPosition [DboTclHelper_sMakeInt 5]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {7}]]
          set pPosition [DboTclHelper_sMakeInt 6]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {8}]]
          set pPosition [DboTclHelper_sMakeInt 7]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {9}]]
          set pPosition [DboTclHelper_sMakeInt 8]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {10}]]
          set pPosition [DboTclHelper_sMakeInt 9]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {11}]]
          set pPosition [DboTclHelper_sMakeInt 10]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {12}]]
          set pPosition [DboTclHelper_sMakeInt 11]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {13}]]
          set pPosition [DboTclHelper_sMakeInt 12]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {14}]]
          set pPosition [DboTclHelper_sMakeInt 13]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {28}]]
          set pPosition [DboTclHelper_sMakeInt 14]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {27}]]
          set pPosition [DboTclHelper_sMakeInt 15]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {26}]]
          set pPosition [DboTclHelper_sMakeInt 16]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {25}]]
          set pPosition [DboTclHelper_sMakeInt 17]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {24}]]
          set pPosition [DboTclHelper_sMakeInt 18]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {23}]]
          set pPosition [DboTclHelper_sMakeInt 19]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {22}]]
          set pPosition [DboTclHelper_sMakeInt 20]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {21}]]
          set pPosition [DboTclHelper_sMakeInt 21]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {20}]]
          set pPosition [DboTclHelper_sMakeInt 22]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {19}]]
          set pPosition [DboTclHelper_sMakeInt 23]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {18}]]
          set pPosition [DboTclHelper_sMakeInt 24]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {17}]]
          set pPosition [DboTclHelper_sMakeInt 25]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {16}]]
          set pPosition [DboTclHelper_sMakeInt 26]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut {15}]]
          set pPosition [DboTclHelper_sMakeInt 27]
          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]
          set mStatusVal [$mStatus Failed]
          if {$mStatusVal == 1} exit
    set mStatus [$mLib SavePackageAll $mPackage]
    set mStatusVal [$mStatus Failed]
    if {$mStatusVal == 1} exit
  
  # [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Saving Library..C:\USERS\SAMI\DESKTOP\FT260S-R.OLB}]
  puts [::orTransformStrOut {INFO(ORDBDLL-1229): XMATIC : Saving Library..C:\USERS\SAMI\DESKTOP\FT260S-R.OLB}]
  set mStatus [$mSession SaveLib $mLib]
  set mStatusVal [$mStatus Failed]
  if {$mStatusVal == 1} exit
  DboTclHelper_sDeleteSession $mSession
  
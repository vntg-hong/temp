package com.hong.currencycalc;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FileDownloadPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

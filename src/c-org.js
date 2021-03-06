const cOrgAbi = require("@fairmint/c-org-abi/abi.json");
const cOrgBytecode = require("@fairmint/c-org-abi/bytecode.json");
const { constants, helpers } = require("hardlydifficult-eth");
const Web3 = require("web3");
const BigNumber = require("bignumber.js");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function getDat(web3, datAddress) {
  web3 = new Web3(web3);
  return await helpers.truffleContract.at(web3, cOrgAbi.dat, datAddress);
}
async function getWhitelist(web3, whitelistAddress) {
  web3 = new Web3(web3);
  return await helpers.truffleContract.at(
    web3,
    cOrgAbi.whitelist,
    whitelistAddress
  );
}
async function getProxyAdmin(web3, proxyAdminAddress) {
  web3 = new Web3(web3);
  return await helpers.truffleContract.at(
    web3,
    cOrgAbi.proxyAdmin,
    proxyAdminAddress
  );
}
async function waitForDeploy(tx) {
  const hash = await tx;
  let receipt;
  do {
    await sleep(1500);
    receipt = await web3.eth.getTransactionReceipt(hash);
  } while (receipt === null);
  return receipt.contractAddress;
}
function deployContract(web3, from, abi, options) {
  web3 = new Web3(web3);
  return new Promise((resolve, reject) => {
    const txObj = new web3.eth.Contract(abi).deploy(options);
    return txObj.estimateGas().then((gas) => {
      gas = new BigNumber(gas);
      gas = gas.times(1.1).dp(0, BigNumber.ROUND_UP); // +10% in case estimate was off
      return txObj
        .send({
          from,
          gas: gas.toFixed(),
        })
        .on("transactionHash", (tx) => {
          return resolve(tx);
        })
        .on("error", (error) => {
          return reject(error);
        });
    });
  });
}
function deployDatTemplate(web3, from) {
  web3 = new Web3(web3);
  return deployContract(web3, from, cOrgAbi.dat, { data: cOrgBytecode.dat });
}
function deployWhitelistTemplate(web3, from) {
  web3 = new Web3(web3);
  return deployContract(web3, from, cOrgAbi.whitelist, {
    data: cOrgBytecode.whitelist,
  });
}
function deployProxyAdmin(web3, from) {
  web3 = new Web3(web3);
  return deployContract(web3, from, cOrgAbi.proxyAdmin, {
    data: cOrgBytecode.proxyAdmin,
  });
}
function deployProxy(web3, from, templateAddress, adminAddress) {
  web3 = new Web3(web3);
  return deployContract(web3, from, cOrgAbi.proxy, {
    data: cOrgBytecode.proxy,
    arguments: [templateAddress, adminAddress, "0x"],
  });
}
async function initializeDat(web3, from, datProxyAddress, options) {
  web3 = new Web3(web3);
  const callOptions = Object.assign(
    {
      initReserve: "42000000000000000000",
      currency: constants.ZERO_ADDRESS,
      initGoal: "0",
      buySlopeNum: "1",
      buySlopeDen: "100000000000000000000",
      investmentReserveBasisPoints: "1000",
      setupFee: "0",
      setupFeeRecipient: constants.ZERO_ADDRESS,
      name: "FAIR token",
      symbol: "FAIR",
    },
    options
  );
  const dat = await getDat(web3, datProxyAddress);
  await dat.initialize(
    callOptions.initReserve,
    callOptions.currency,
    callOptions.initGoal,
    callOptions.buySlopeNum,
    callOptions.buySlopeDen,
    callOptions.investmentReserveBasisPoints,
    callOptions.setupFee,
    callOptions.setupFeeRecipient,
    callOptions.name,
    callOptions.symbol,
    { from }
  );
}
async function updateDat(web3, from, datProxyAddress, options) {
  web3 = new Web3(web3);
  const callOptions = Object.assign(
    {
      revenueCommitmentBasisPoints: "1000",
      feeBasisPoints: "0",
      burnThresholdBasisPoints: false,
      minInvestment: "1",
      minDuration: "0",
      beneficiary: options.control,
      feeCollector: options.control,
    },
    options
  );
  const dat = await getDat(web3, datProxyAddress);
  await dat.updateConfig(
    callOptions.whitelistAddress,
    callOptions.beneficiary,
    callOptions.control,
    callOptions.feeCollector,
    callOptions.feeBasisPoints,
    callOptions.revenueCommitmentBasisPoints,
    callOptions.minInvestment,
    callOptions.minDuration,
    {
      from,
    }
  );
}
async function initializeWhitelist(
  web3,
  from,
  whitelistProxyAddress,
  datProxyAddress
) {
  web3 = new Web3(web3);
  const whitelist = await getWhitelist(web3, whitelistProxyAddress);
  await whitelist.initialize(datProxyAddress, { from });
}
async function whitelistUpdateJurisdictionFlows(
  web3,
  from,
  whitelistProxyAddress,
  fromJurisdictionIds,
  toJurisdictionIds,
  lockupLengths
) {
  web3 = new Web3(web3);
  const whitelist = await getWhitelist(web3, whitelistProxyAddress);
  await whitelist.updateJurisdictionFlows(
    fromJurisdictionIds,
    toJurisdictionIds,
    lockupLengths,
    {
      from,
    }
  );
}
async function whitelistApprove(
  web3,
  from,
  whitelistProxyAddress,
  account,
  jurisdictionId
) {
  web3 = new Web3(web3);
  const whitelist = await getWhitelist(web3, whitelistProxyAddress);
  await whitelist.approveNewUsers([account], [jurisdictionId], {
    from,
  });
}
async function whitelistTransferOwnership(
  web3,
  from,
  whitelistProxyAddress,
  newOwner
) {
  web3 = new Web3(web3);
  const whitelist = await getWhitelist(web3, whitelistProxyAddress);
  await whitelist.transferOwnership(newOwner, {
    from,
  });
}
async function proxyAdminTransferOwnership(
  web3,
  from,
  proxyAdminAddress,
  newOwner
) {
  web3 = new Web3(web3);
  const proxyAdmin = await getProxyAdmin(web3, proxyAdminAddress);
  await proxyAdmin.transferOwnership(newOwner, { from });
}
async function proxyAdminUpgrade(
  web3,
  from,
  proxyAdminAddress,
  proxyAddress,
  newImplementation
) {
  web3 = new Web3(web3);
  const proxyAdmin = await getProxyAdmin(web3, proxyAdminAddress);
  await proxyAdmin.upgrade(proxyAddress, newImplementation, { from });
}

module.exports = {
  // 1)
  deployDatTemplate,
  // 2)
  deployWhitelistTemplate,
  // 3)
  deployProxyAdmin,
  // 4) 5)
  deployProxy,
  // 6)
  initializeDat,
  // 7)
  initializeWhitelist,
  // 8-9)
  whitelistUpdateJurisdictionFlows,
  whitelistApprove,
  // 10)
  updateDat,
  // 11)
  whitelistTransferOwnership,
  // 12)
  proxyAdminTransferOwnership,
  deploy: async (web3, options) => {
    // Once per network:
    // 1) deploy dat template
    //   - enter address
    // 2) deploy whitelist template
    //   - enter address

    // Once per dat:
    // 3) deploy proxy admin
    //   - enter address
    // 4) deploy dat proxy(datTemplate.address, proxyAdmin.address)
    //   - enter address
    // 5) deploy whitelist proxy(whitelistTemplate.address, proxyAdmin.address)
    //   - enter address
    // 6) datProxy.initialize(datFixedSettings)
    //   - display: initialized
    // 7) whitelistProxy.initialize(datProxy.address)
    //   - display: initialized
    // 8-9) whitelist.approveNewUsers(control, beneficiary)
    // 10) datProxy.updateConfig(whitelistProxy.address, datUpdatableSettings)
    //   - no change (just display all settings)
    //   - include new control account address
    // 11) whitelistProxy.transferOwnership(new control address)
    //   - no change (just display all settings)
    // 12) proxyAdmin.transferOwnership(new control address)
    //   - no change (just display all settings)

    const datTemplateAddress = await waitForDeploy(
      deployDatTemplate(web3, options.control)
    );
    const whitelistTemplateAddress = await waitForDeploy(
      deployWhitelistTemplate(web3, options.control)
    );
    const proxyAdminAddress = await waitForDeploy(
      deployProxyAdmin(web3, options.control)
    );
    const datProxyAddress = await waitForDeploy(
      deployProxy(web3, options.control, datTemplateAddress, proxyAdminAddress)
    );
    const whitelistProxyAddress = await waitForDeploy(
      deployProxy(
        web3,
        options.control,
        whitelistTemplateAddress,
        proxyAdminAddress
      )
    );

    options.whitelistAddress = whitelistProxyAddress;
    await initializeDat(web3, options.control, datProxyAddress, options);

    await initializeWhitelist(
      web3,
      options.control,
      whitelistProxyAddress,
      datProxyAddress
    );
    await whitelistUpdateJurisdictionFlows(
      web3,
      options.control,
      whitelistProxyAddress,
      [1, 4, 4],
      [4, 1, 4],
      [1, 1, 1]
    );
    // Mint and burn is the DAT at jurisdiction 1
    await whitelistApprove(
      web3,
      options.control,
      whitelistProxyAddress,
      web3.utils.padLeft(0, 40),
      1
    );
    await whitelistApprove(
      web3,
      options.control,
      whitelistProxyAddress,
      options.control,
      4
    );
    if (options.beneficiary && options.beneficiary !== options.control) {
      await whitelistApprove(
        web3,
        options.control,
        whitelistProxyAddress,
        options.beneficiary,
        4
      );
    }

    await updateDat(web3, options.control, datProxyAddress, options);

    const dat = await getDat(web3, datProxyAddress);
    const whitelist = await getWhitelist(web3, whitelistProxyAddress);
    return { dat, whitelist };
  },
  getDat,
  getWhitelist,
  proxyAdminUpgrade,
};

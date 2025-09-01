using FrontEnd.Core.Interfaces;
using FrontEnd.Modules.TimelineScheduler.Models;
using GeeksCoreLibrary.Core.Extensions;
using Microsoft.AspNetCore.Mvc;

namespace FrontEnd.Modules.TimelineScheduler.Controllers;

[Area("TimelineScheduler"), Route("Modules/TimelineScheduler")]
public class TimelineSchedulerController : Controller
{
    private readonly IBaseService baseService;

    public TimelineSchedulerController(IBaseService baseService)
    {
        this.baseService = baseService;
    }
        
    public IActionResult Index([FromQuery]TimelineSchedulerViewModel viewModel)
    {
        viewModel ??= new TimelineSchedulerViewModel();
        var defaultModel = baseService.CreateBaseViewModel();

        viewModel.Settings = defaultModel.Settings;
        viewModel.WiserVersion = defaultModel.WiserVersion;
        viewModel.SubDomain = defaultModel.SubDomain;
        viewModel.IsTestEnvironment = defaultModel.IsTestEnvironment;
        viewModel.Wiser1BaseUrl = defaultModel.Wiser1BaseUrl;
        viewModel.ApiAuthenticationUrl = defaultModel.ApiAuthenticationUrl;
        viewModel.ApiRoot = defaultModel.ApiRoot;
        viewModel.LoadPartnerStyle = defaultModel.LoadPartnerStyle;
        viewModel.ZeroEncrypted = "0".EncryptWithAesWithSalt("FSdkk338s8KSks3nssksk33F", true); // TODO: Encryption key dynamisch maken
        viewModel.ResourcesQueryId = "100287".EncryptWithAesWithSalt("FSdkk338s8KSks3nssksk33F", true); // TODO: ResourcesQueryId dynamisch maken
     
        return View(viewModel);
    }
}